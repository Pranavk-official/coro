# TCP relay for dev/android-emulator.sh: tcp-relay.py <listen-host> <listen-port> <target-host> <target-port>
import socket, threading
def pipe(a, b):
    try:
        while (d := a.recv(65536)): b.sendall(d)
    except OSError: pass
    finally:
        for s in (a, b):
            try: s.shutdown(socket.SHUT_RDWR)
            except OSError: pass
srv = socket.socket(); srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
import sys
LH, LP, RH, RP = sys.argv[1], int(sys.argv[2]), sys.argv[3], int(sys.argv[4])
srv.bind((LH, LP)); srv.listen(64)
while True:
    c, _ = srv.accept()
    u = socket.create_connection((RH, RP))
    threading.Thread(target=pipe, args=(c, u), daemon=True).start()
    threading.Thread(target=pipe, args=(u, c), daemon=True).start()
