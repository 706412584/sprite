import py_compile, hashlib
p = r"d:\User\70641\Documents\SCE Projects\game_entry_0\tools\sprite\server.py"
o = r"d:\User\70641\Documents\SCE Projects\game_entry_0\tools\sprite\_compile.txt"
h = hashlib.sha256(open(p, "rb").read()).hexdigest()
try:
    py_compile.compile(p, doraise=True)
    msg = "COMPILE_OK sha256=" + h
except Exception as e:
    msg = "COMPILE_FAIL " + repr(e)
open(o, "w", encoding="utf-8").write(msg)
