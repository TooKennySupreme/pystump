#!/usr/bin/env python
# Module for authenticating against Active Directory
# by Alan Moore

import ldap3 as ldap
from .authenticator import auth_backend

class AD(auth_backend):
    def __init__(self, host='localhost', port="389", base_dn="",  bind_dn_username="", bind_dn_password="", require_group=None, ssl=False):
        """Contructor for the connection.  Assumes plaintext LDAP"""
        self.error = ""
        self.host = host
        self.base_dn = base_dn
        self.bind_dn = bind_dn_username
        self.bind_pw = bind_dn_password
        self.require_group = require_group
        ldap.set_option(ldap.OPT_X_TLS_REQUIRE_CERT, False)
        ldap.set_option(ldap.OPT_REFERRALS, 0)
        self.authenticated_user = None
        self.authenticated_dn = None
        self.authsource = "Active Directory on {}".format(base_dn)
        self.ldap_url = ''.join([
            (ssl and "ldaps://") or "ldap://",
            self.host,
            (port and ":{}".format(port)) or ''
        ])

        #attempt to connect and bind to the server
        try:
            self.con = ldap.initialize(self.ldap_url)
            if ssl:
                self.con.start_tls_s()
            self.con.simple_bind_s(self.bind_dn, self.bind_pw)
        except ldap.INVALID_CREDENTIALS:
            self.error = "Could not bind to server {}.".format(self.host)
            if self.bind_dn is not None:
                self.error += "as %s" % self.bind_dn
                self.con = False
        except ldap.SERVER_DOWN:
            self.error = "Could not make connection to {}.".format(self.host)

    def check (self, username=None, password=None):
        """Given a simple username and password, return true or false if the user is authenticated"""
        if self.con:
            res = self.con.search_s(self.base_dn, ldap.SCOPE_SUBTREE, "sAMAccountName=%s" % username)
        else:
            return False
        #For some stupid reason, ldap will bind successfully with a valid username and a BLANK PASSWORD, so we have to disallow blank passwords.
        if not password:
            self.error = "Invalid credentials: Login as {} failed.".format(username)
            return False

        if not res[0][0]:
            self.error = "No such user {}.".format(username)
            return False
        else:
            dn = res[0][1]["userPrincipalName"][0]
            try:
                self.con.simple_bind_s(dn, password)
                self.authenticated_user = username
                self.authenticated_dn = dn
            except:
                self.error = "Invalid credentials: Login as {} failed".format(username)
                return False

        #If you've gotten to this point, the username/password checks out
        if self.require_group and not (self.in_group(self.require_group)):
            self.error = "Permission denied"
            return False

        return True # All tests passed!


    def in_group(self, group):
        group_res = self.con.search_s(self.base_dn, ldap.SCOPE_SUBTREE, "cn={}".format(group))
        if group_res:
            group_dn = group_res[0][0]
            if group_dn in self.info_on(self.authenticated_user).get("memberOf"):
                return True
        return False

    def info_on(self, username):
        """Returns ldap information on the given username"""
        if self.con:
            res = self.con.search_s(self.base_dn, ldap.SCOPE_SUBTREE, "sAMAccountName={}".format(username))
        else:
            return False

        if not res:
            self.error = "No such user {}.".format(username)
            return False

        return res[0][1]

    def get_auth_user_fullname(self):
        if self.authenticated_user:
            return self.info_on(self.authenticated_user).get("name")[0]
        return ""

    def get_auth_user_email(self):
        if self.authenticated_user:
            email = self.info_on(self.authenticated_user).get("mail", [''])[0]
            return email
        return None