#!/usr/bin/env python3
"""Local capture servers for the QA run.

SMTP on 1025 writes each received message to qa/evidence/run2/smtp/.
HTTP on 9099 writes each webhook POST (headers + body) to qa/evidence/run2/hooks/.
Neither speaks to anything outside this machine.
"""
import json
import os
import socketserver
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

OUT = "/home/user/asobeast/qa/evidence/run2"
os.makedirs(f"{OUT}/smtp", exist_ok=True)
os.makedirs(f"{OUT}/hooks", exist_ok=True)

# ---------------------------------------------------------------- SMTP (RFC 5321 subset)
class SMTPHandler(socketserver.StreamRequestHandler):
    def send(self, line):
        self.wfile.write((line + "\r\n").encode())
        self.wfile.flush()

    def handle(self):
        self.send("220 qa-smtp ready")
        data_mode = False
        body = []
        envelope = {"mail_from": None, "rcpt_to": []}
        while True:
            raw = self.rfile.readline()
            if not raw:
                return
            line = raw.decode("utf-8", "replace").rstrip("\r\n")
            if data_mode:
                if line == ".":
                    data_mode = False
                    n = len(os.listdir(f"{OUT}/smtp"))
                    with open(f"{OUT}/smtp/msg-{n:03d}.txt", "w") as fh:
                        fh.write(json.dumps(envelope) + "\n\n" + "\n".join(body))
                    body = []
                    self.send("250 OK queued")
                else:
                    body.append(line)
                continue
            up = line.upper()
            if up.startswith("EHLO") or up.startswith("HELO"):
                self.send("250-qa-smtp")
                self.send("250 SIZE 10485760")
            elif up.startswith("MAIL FROM"):
                envelope["mail_from"] = line[10:].strip()
                self.send("250 OK")
            elif up.startswith("RCPT TO"):
                envelope["rcpt_to"].append(line[8:].strip())
                self.send("250 OK")
            elif up.startswith("DATA"):
                data_mode = True
                self.send("354 End data with <CR><LF>.<CR><LF>")
            elif up.startswith("QUIT"):
                self.send("221 Bye")
                return
            elif up.startswith("RSET"):
                envelope = {"mail_from": None, "rcpt_to": []}
                self.send("250 OK")
            elif up.startswith("NOOP"):
                self.send("250 OK")
            else:
                self.send("250 OK")


class ThreadedTCP(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True
    daemon_threads = True


# ---------------------------------------------------------------- webhook sink
class HookHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get("content-length", 0))
        body = self.rfile.read(length).decode("utf-8", "replace")
        n = len(os.listdir(f"{OUT}/hooks"))
        with open(f"{OUT}/hooks/hook-{n:03d}.json", "w") as fh:
            json.dump({"path": self.path, "headers": dict(self.headers), "body": body}, fh, indent=1)
        self.send_response(200)
        self.send_header("content-type", "application/json")
        self.end_headers()
        self.wfile.write(b'{"ok":true}')

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    threading.Thread(
        target=lambda: ThreadedTCP(("127.0.0.1", 1025), SMTPHandler).serve_forever(), daemon=True
    ).start()
    print("smtp on 1025, http hook sink on 9099", flush=True)
    HTTPServer(("127.0.0.1", 9099), HookHandler).serve_forever()
