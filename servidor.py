import json
import os
import hashlib
import secrets


PASTA_ESTATICA = "static"
ARQUIVO_USUARIOS = os.path.join("data", "usuarios.json")

TIPOS = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".svg": "image/svg+xml",
}

def carregar_usuarios():
    #em processo


def salvar_usuarios(usuarios):
    #em processo

def gerar_hash(senha, sal=None):
    sal = sal or secrets.token_hex(16)
    h = hashlib.pbkdf2_hmac("sha256", senha.encode(), bytes.fromhex(sal), 100_000)
    return sal, h.hex()


def senha_confere(senha, sal, hash_salvo):
    _, h = gerar_hash(senha, sal)
    return secrets.compare_digest(h, hash_salvo)

def cadastrar(self, d):
    email = d.get("email", "").strip().lower()
    nome = d.get("nome", "").strip()
    senha = d.get("senha", "")
    if not nome or "@" not in email:
        return self.responder_json({"erro": "Preencha nome e um e-mail válido."}, 400)
    if len(senha) < 4 or senha != d.get("confirma"):
        return self.responder_json({"erro": "As senhas precisam ser iguais e ter 4+ caracteres."}, 400)

    usuarios = carregar_usuarios()
    if email in usuarios:
        return self.responder_json({"erro": "Este e-mail já tem cadastro."}, 400)

    sal, h = gerar_hash(senha)
    usuarios[email] = {
        "nome": nome, "email": email, "ano": d.get("ano", ""),
        "sal": sal, "hash": h,
        "dias": [], "nivel": "", "aprendidas": [],
    }
    salvar_usuarios(usuarios)
    self.responder_json({"ok": True, "nome": nome})

def entrar(self, d):
    u = carregar_usuarios().get(d.get("email", "").strip().lower())
    if not u or not senha_confere(d.get("senha", ""), u["sal"], u["hash"]):
        return self.responder_json({"erro": "E-mail ou senha incorretos."}, 400)
    # TODO: criar sessão (token) para lembrar quem está logado
    self.responder_json({"ok": True, "nome": u["nome"]})


if __name__ == "__main__":
    servidor = ThreadingHTTPServer(("127.0.0.1", 8000), Handler)
    print("Rodando em http://127.0.0.1:8000  (Ctrl+C para parar)")
    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        print("\nEncerrado.")