#!/usr/bin/env python
"""
PyStump
Copyright 2014 Alan D Moore
www.alandmoore.com
Licensed to you under the terms of the GNU GPL v3.
See the included COPYING file for details.

PyStump is a web-based announcements display system.

It's written in python and requires the python flask framework
and your favorite standards-compliant web browser.

"""
from functools import wraps

from flask import (
    Flask, g, render_template, request,
    abort, redirect, session, url_for,
    send_from_directory
)
from includes.util import file_allowed, save_file, delete_file
from includes.database import Database
from includes.auth.authenticator import Authenticator, dummy_auth
from includes.auth.ldap_auth import AD, EDirectory
from includes.auth.sqlite_auth import SQLiteAuth
from includes import lookups

app = Flask(__name__, instance_relative_config=True)
app.config.from_object("config")
app.config.from_pyfile("config.py", silent=True)


# Wrappers to secure callbacks

def login_required(view_function):
    """Redirect to the login page if the session is not authenticated"""

    @wraps(view_function)
    def decorated_function(*args, **kwargs):
        """Function wrapped by login_required."""

        if not session.get("auth"):
            return redirect(url_for("login_page", next=request.url))
        return view_function(*args, **kwargs)
    return decorated_function


def admin_required(view_function):
    """Redirect to the login page if the session is not authenticated"""

    @wraps(view_function)
    def decorated_function(*args, **kwargs):
        """Function wrapped by login_required."""

        if not session.get("is_admin"):
            abort(403)
        return view_function(*args, **kwargs)
    return decorated_function


@app.before_request
def before_request():
    """Run setup operations before each request."""

    g.debug = app.config.get("DEBUG")
    g.db = Database(app.config.get("DATABASE_FILE"))
    g.missing_tables = g.db.get_missing_tables()
    if len(g.missing_tables) > 0:
        g.db_corrupt = True
    else:
        g.db_corrupt = False
        settings = g.db.get_settings()
        g.std_args = {
            "settings": settings,
            "site_name": app.config.get("SITE_NAME", 'PyStump'),
            "transition_backend": app.config.get("TRANSITIONS", 'animatecss'),
            "show_title": settings.get("Show Title", [0])[0] == '1',
            "show_meta": '1' in (x[0] for x in (
                settings.get("Show Author", [0]),
                settings.get("Show Updated", [0])
            )),
        }


@app.route("/")
def index():
    """Main page of the application.  Shows the announcments."""

    if g.db_corrupt:
        return render_template(
            "corrupt.jinja2",
            missing=g.missing_tables,
            filename=app.config.get("DATABASE_FILE")
        )
    else:
        announcements = g.db.get_active_announcements()
        return render_template(
            "main.jinja2",
            announcements=announcements,
            **g.std_args
        )


@app.route("/slides")
def slides():
    """Return just the slides portion of the announcments.

    Used by AJAX calls to repopulate the announcments.
    """

    announcements = g.db.get_active_announcements()
    return render_template(
        "slides.jinja2",
        announcements=announcements,
        **g.std_args
    )


@app.route("/preview/<announcement_id>")
def preview(announcement_id):
    """Return a single slide, rendered"""

    announcements = [g.db.get_announcement(announcement_id)]

    return render_template(
        "main.jinja2",
        announcements=announcements,
        **g.std_args
    )


@app.route("/uploads/<path:filename>")
def uploads(filename):
    """Return an uploaded file."""

    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)


@app.route("/list")
@login_required
def list_announcements():
    """Show the list of all announcments.  Part of the admin."""

    announcements = g.db.get_all_announcements()
    return render_template(
        "list.jinja2",
        announcements=announcements,
        **g.std_args
    )


@app.route("/edit")
@app.route("/edit/<announcement_id>")
def edit_announcement(announcement_id=None):
    """Show the edit form for an announcement."""

    announcement = g.db.get_announcement(announcement_id)
    transitions = (
        lookups.transitions_animatecss
        if app.config.get("TRANSITIONS", "animatecss") == 'animatecss'
        else lookups.transitions_jquery_ui
    )
    return render_template(
        "edit.jinja2",
        announcement=announcement,
        bg_image_modes=lookups.bg_image_modes,
        transitions=transitions,
        **g.std_args
    )


# Login, Logout
@app.route("/login", methods=['GET', 'POST'])
def login_page():
    """Show the login screen."""

    error = None
    username = None
    authenticators = {
        "AD": AD, "dummy": dummy_auth,
        "eDirectory": EDirectory, "sqlite": SQLiteAuth
    }
    if request.method == 'POST':
        # attempt to authenticate
        auth = Authenticator(
            authenticators[app.config.get("AUTH_BACKEND")],
            **app.config.get("AUTH_CONFIG")
        )
        if auth.check(request.form['username'], request.form['password']):
            session['auth'] = True
            session['username'] = request.form['username']
            session['user_realname'] = auth.get_user_name()
            session['user_email'] = auth.get_user_email()
            session['is_admin'] = auth.is_admin()
            return redirect(url_for("index"))
        else:
            username = request.form['username']
            error = "Login Failed"
    return render_template(
        "login.jinja2",
        error=error,
        username=username,
        site_name=app.config.get("SITE_NAME")
    )


@app.route("/logout")
@login_required
def logout():
    """Remove session authentication."""

    session['auth'] = False
    session['username'] = None
    session['user_realname'] = None
    session['is_admin'] = False

    return redirect(url_for("index"))


@app.route("/settings")
@admin_required
@login_required
def settings_form():
    """Show the settings form."""

    return render_template("settings.jinja2", **g.std_args)


@admin_required
@login_required
@app.route("/initialize")
def initialize_database():
    """Show the form for initializing the database."""

    return render_template(
        "initialize_form.jinja2",
        filename=app.config['DATABASE_FILE'],
        **g.std_args
    )


@admin_required
@login_required
@app.route("/clean_expired")
def clean_expired_form():
    """Show the form to confirm cleaning expired announcements."""

    return render_template(
        "clean_expired_form.jinja2",
        **g.std_args
    )


def save_announcement(formdata, username):
    incoming = formdata.to_dict()
    current = g.db.get_announcement(incoming.get("id", None))
    bg_image = request.files.get('bg_image')

    if incoming.get("delete_bg_image"):
        delete_file(current.get("bg_image"), app.config["UPLOAD_FOLDER"])
        incoming['bg_file'] = ''
    elif incoming.get("delete"):
        g.db.delete_announcement(incoming.get("id", None))
        if current.get("bg_image"):
            delete_file(current["bg_image"], app.config["UPLOAD_FOLDER"])
    elif (
        bg_image and
        file_allowed(
            bg_image.filename,
            app.config.get("ALLOWED_FILE_EXTENSIONS")
        )
    ):
        incoming['bg_image'] = save_file(bg_image, app.config["UPLOAD_FOLDER"])
    else:
        incoming['bg_image'] = current.get('bg_image')

    return g.db.save_announcement(incoming, username)


@app.route("/post/<callback>", methods=["POST"])
def post(callback):
    """Handle posts to the application.

    Each post should have a callback indicating what operation
    to execute, as well as data to send along to the operation.
    """

    callbacks = {
        "announcement": save_announcement
    }

    if session.get("is_admin"):
        callbacks["settings"] = g.db.save_settings
        callbacks["initialize"] = g.db.do_initialize_db
        callbacks['clean_expired'] = g.db.clean_expired

    if callback not in callbacks.keys() or not session.get("auth"):
        abort(403)
    else:
        result = callbacks.get(callback)(
            request.form, username=session.get("username")
        )
        if request.form.get("_redirect_"):
            return redirect(request.form.get("_redirect_"))
        else:
            return result


if __name__ == "__main__":
    app.debug = True
    host = app.config.get("HOST", 'localhost')
    port = app.config.get("PORT", 5000)
    print("PyStump running at http://{}:{}".format(host, port))
    app.run(host=host, port=port)
