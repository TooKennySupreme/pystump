"""
Miscellaneous utility functions for Pystump
"""

import sys
import os
from flask import g
from datetime import datetime
from werkzeug import secure_filename
import uuid
import base64
from pprint import pformat

from dateutil.parser import parse


def debug(*messages):
    if g.debug:
        sys.stderr.write(pformat("\n".join([str(m) for m in messages])))
    else:
        pass


def string_to_datetime(datestring):

    if not datestring:
        return None

    if type(datestring) == bytes:
        datestring = datestring.decode("utf-8")

    return parse(datestring)

    formats = (
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%dT%H:%M%z",
        "%Y-%m-%d %H:%M:%S%z",
        "%Y-%m-%d %H:%M%z",
        "%Y-%m-%d %H:%M",
        "%Y-%m-%dT%H:%M",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S",
        "%m/%d/%Y %H:%M",
        "%m/%d/%Y %I:%M",
        "%-m/%-d/%Y %-I:%M"
    )
    errs = []

    for f in formats:
        try:
            dt = datetime.strptime(datestring, f)
        except ValueError:
            errs.append("{} doesn't match {}\n".format(datestring, f))
            continue
        else:
            return dt
    debug("\n".join(errs))
    return None


def datetime_to_string(dt):

    if type(dt) is not datetime:
        return ''

    return dt.strftime("%Y-%m-%dT%H:%M:%S%z")


def file_allowed(filename, allowed_extensions):
    """Determine if a filename is acceptable for upload."""
    allowed = (
        allowed_extensions is None or
        ('.' in filename and
         filename.rsplit('.', 1)[1].lower() in allowed_extensions)
    )
    return allowed


def save_file(file_obj, folder):
    """Saves a file to a unique location with a secure filename"""

    directory = (
        base64.urlsafe_b64encode(uuid.uuid4().bytes)
        .strip(b"=").decode("UTF-8")
    )
    filename = secure_filename(file_obj.filename)
    upload_directory = os.path.join(folder, directory)
    os.mkdir(upload_directory)
    file_obj.save(
        os.path.join(folder, directory, filename)
    )
    return os.path.join(directory, filename)


def delete_file(filename, folder):
    """Remove a file from a folder"""

    containing_dir = os.path.dirname(filename)
    path = os.path.join(folder, filename)

    if os.path.exists(path):
        os.unlink(path)
        if containing_dir:
            os.rmdir(os.path.join(folder, containing_dir))
        return True

    return False
