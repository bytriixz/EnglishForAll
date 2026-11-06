import express from 'express';
import { Sequelize, DataTypes } from 'sequelize';
import bcrypt from 'bcrypt';
import 'dotenv/config';
import session from 'express-session';


const app = express();
const PORT = process.env.PORT || 3000;


const NIVEIS = ['Nulo', 'Iniciante', 'Intermediário', 'Avançado'];


app.use(express.json());


app.use(
  session({
    secret: process.env.sessao_user,
    resave: false,
    saveUninitialized: true,
  })
);


app.use((req, res, next) => {
  const precisaLogin = ['/inicio.html', '/questionario.html'].includes(req.path) || req.path.startsWith('/functions/');
  const precisaAdmin = req.path === '/admin.html';

  if ((precisaLogin || precisaAdmin) && !req.session.user) {
    return res.redirect('/login.html#entrar');
  }
  if (precisaAdmin && !req.session.user.isAdmin) {
    return res.redirect('/inicio.html');
  }
  next();
});

app.use(express.static('static'));


app.get('/', (req, res) => {
  res.redirect('/login.html');
});


function exigirLogin(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: "Não autorizado." });
  next();
}

function exigirAdmin(req, res, next) {
  if (!req.session.user?.isAdmin) return res.status(403).json({ error: "Acesso restrito a administradores." });
  next();
}

//evita repetir try/catch em todas as rotas: qualquer erro inesperado vira "erro interno"
const rota = (funcao) => async (req, res) => {
  try {
    await funcao(req, res);
  } catch (error) {
    console.error("Erro na rota", req.method, req.path, error);
    res.status(500).json({ error: "Erro interno." });
  }
};


//-------BANCO DE DADOS-------

//configuração do banco de dados
const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: "usuarios.db",
});

//modelo de usuário
const Usuario = sequelize.define("Usuario", {
  fullname: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  username: { type: DataTypes.STRING, allowNull: false, unique: true },
  password: { type: DataTypes.STRING, allowNull: false },
  anoEscolar: { type: DataTypes.STRING, allowNull: true },
  isAdmin: { type: DataTypes.BOOLEAN, defaultValue: false },
  questRespondido: { type: DataTypes.BOOLEAN, defaultValue: false },
  datas: { type: DataTypes.STRING, allowNull: true },
  nivel: { type: DataTypes.STRING, allowNull: true },
});

//categorias de exercícios (ex.: Gramática, Vocabulário)
const Categoria = sequelize.define("Categoria", {
  nome: { type: DataTypes.STRING, allowNull: false, unique: true },
});

//exercícios de múltipla escolha
const Exercicio = sequelize.define("Exercicio", {
  enunciado: { type: DataTypes.TEXT, allowNull: false },
  alternativas: { type: DataTypes.JSON, allowNull: false },       //lista de textos
  respostaCorreta: { type: DataTypes.INTEGER, allowNull: false }, //posição da alternativa correta (começa em 0)
  dificuldade: { type: DataTypes.STRING, allowNull: false },
});

//cada resposta que um aluno dá a um exercício
const Progresso = sequelize.define("Progresso", {
  resposta: { type: DataTypes.INTEGER, allowNull: false },
  correto: { type: DataTypes.BOOLEAN, allowNull: false },
});

//relações entre as tabelas
Categoria.hasMany(Exercicio, { foreignKey: 'categoriaId', as: 'exercicios' });
Exercicio.belongsTo(Categoria, { foreignKey: 'categoriaId', as: 'categoria' });
Usuario.hasMany(Progresso, { foreignKey: 'usuarioId' });
Progresso.belongsTo(Usuario, { foreignKey: 'usuarioId' });
Exercicio.hasMany(Progresso, { foreignKey: 'exercicioId', onDelete: 'CASCADE' });
Progresso.belongsTo(Exercicio, { foreignKey: 'exercicioId', as: 'exercicio' });

//mantém as tabelas atualizadas (alter: true adiciona as colunas novas sem apagar os dados)
await sequelize.sync({ alter: true });

//transforma em admin o usuário indicado no arquivo .env (ADMIN_USERNAME=nome_do_usuario)
if (process.env.ADMIN_USERNAME) {
  await Usuario.update({ isAdmin: true }, { where: { username: process.env.ADMIN_USERNAME } });
}


//-------CADASTRO DE USUÁRIOS-------

app.post("/cadastrarUser", async (req, res) => {
  const { fullname, email, username, password, anoEscolar } = req.body;

  try {
    const senhaCriptografada = await bcrypt.hash(password, 10);
    await Usuario.create({
      fullname,
      email,
      username,
      anoEscolar,
      password: senhaCriptografada,
    });

    res.status(201).json({ message: "Conta criada com sucesso!" });

  } catch (error) {
    //CORREÇÃO: o nome certo do erro é SequelizeUniqueConstraintError
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(400).json({ error: "Usuário ou email já cadastrado." });
    }

    console.error("Erro ao cadastrar", error);
    res.status(500).json({ error: "Erro interno ao cadastrar usuário." });
  }
});


//-------LOGIN DO USUÁRIO-------

app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const usuario = await Usuario.findOne({ where: { username } });

    if (!usuario) {
      return res.status(401).json({ error: "Usuário inválido." });
    }

    const senhaValida = await bcrypt.compare(password, usuario.password);

    if (!senhaValida) {
      return res.status(401).json({ error: "Senha inválida." });
    }

    //registra a sessão do usuário
    req.session.user = {
      id: usuario.id,
      username: usuario.username,
      fullname: usuario.fullname,
      email: usuario.email,
      isAdmin: usuario.isAdmin,
    };

    res.status(200).json({
      message: "Login realizado com sucesso.",
      questRespondido: usuario.questRespondido
    });

  } catch (error) {
    console.error("Erro no login: ", error);
    res.status(500).json({ error: "Erro interno ao realizar login." });
  }
});

//informa ao frontend quem está logado (e se é admin)
app.get("/api/me", exigirLogin, (req, res) => {
  res.json(req.session.user);
});


//-------QUESTIONÁRIO-------

app.post("/salvar-questionario", async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: "Não autorizado." });
  }

  const { dias, nivel } = req.body;

  try {
    const usuario = await Usuario.findByPk(req.session.user.id);
    if (!usuario) {
      return res.status(404).json({ error: "Usuário não encontrado." });
    }

    usuario.datas = Array.isArray(dias) ? dias.join(", ") : dias;
    usuario.nivel = nivel;
    usuario.questRespondido = true;

    await usuario.save();

    req.session.user.nivelIngles = nivel;

    res.status(200).json({ message: "Respostas salvas com sucesso!" });
  } catch (error) {
    console.error("Erro ao salvar questionário:", error);
    res.status(500).json({ error: "Erro interno ao salvar." });
  }
});


//CATEGORIAS E EXERCÍCIOS


app.get("/api/niveis", exigirLogin, (req, res) => {
  res.json(NIVEIS);
});


app.get("/api/categorias", exigirLogin, rota(async (req, res) => {
  res.json(await Categoria.findAll({ order: [['nome', 'ASC']] }));
}));

//ADMIN: cria uma categoria
app.post("/api/admin/categorias", exigirLogin, exigirAdmin, async (req, res) => {
  const nome = String(req.body.nome || "").trim();
  if (!nome) return res.status(400).json({ error: "Informe o nome da categoria." });

  try {
    const categoria = await Categoria.create({ nome });
    res.status(201).json(categoria);
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(400).json({ error: "Essa categoria já existe." });
    }
    console.error("Erro ao criar categoria:", error);
    res.status(500).json({ error: "Erro interno ao criar categoria." });
  }
});


app.get("/api/exercicios", exigirLogin, rota(async (req, res) => {
  const where = {};
  if (req.query.categoriaId) where.categoriaId = req.query.categoriaId;
  if (req.query.dificuldade) where.dificuldade = req.query.dificuldade;

  const lista = await Exercicio.findAll({
    where,
    include: { model: Categoria, as: 'categoria' },
    order: [['id', 'DESC']],
  });

  const admin = req.session.user.isAdmin;
  res.json(lista.map((e) => {
    const dados = e.toJSON();
    if (!admin) delete dados.respostaCorreta;
    return dados;
  }));
}));

app.post("/api/admin/exercicios", exigirLogin, exigirAdmin, rota(async (req, res) => {
  const { enunciado, alternativas, respostaCorreta, dificuldade, categoriaId } = req.body;

  if (!String(enunciado || "").trim()) {
    return res.status(400).json({ error: "Informe o enunciado." });
  }
  if (!Array.isArray(alternativas) || alternativas.length < 2 || !alternativas.every((a) => String(a).trim())) {
    return res.status(400).json({ error: "Informe pelo menos 2 alternativas preenchidas." });
  }
  if (!Number.isInteger(respostaCorreta) || respostaCorreta < 0 || respostaCorreta >= alternativas.length) {
    return res.status(400).json({ error: "Marque qual alternativa é a correta." });
  }
  if (!NIVEIS.includes(dificuldade)) {
    return res.status(400).json({ error: "Nível de dificuldade inválido." });
  }

  const categoria = await Categoria.findByPk(categoriaId);
  if (!categoria) {
    return res.status(400).json({ error: "Categoria não encontrada." });
  }

  const exercicio = await Exercicio.create({
    enunciado: String(enunciado).trim(),
    alternativas: alternativas.map((a) => String(a).trim()),
    respostaCorreta,
    dificuldade,
    categoriaId: categoria.id,
  });

  res.status(201).json(exercicio);
}));


app.delete("/api/admin/exercicios/:id", exigirLogin, exigirAdmin, rota(async (req, res) => {
  const apagados = await Exercicio.destroy({ where: { id: req.params.id } });
  if (!apagados) return res.status(404).json({ error: "Exercício não encontrado." });
  res.json({ message: "Exercício apagado." });
}));



app.post("/api/exercicios/:id/responder", exigirLogin, rota(async (req, res) => {
  const exercicio = await Exercicio.findByPk(req.params.id);
  if (!exercicio) return res.status(404).json({ error: "Exercício não encontrado." });

  const { resposta } = req.body;
  if (!Number.isInteger(resposta) || resposta < 0 || resposta >= exercicio.alternativas.length) {
    return res.status(400).json({ error: "Resposta inválida." });
  }

  const correto = resposta === exercicio.respostaCorreta;

  await Progresso.create({
    usuarioId: req.session.user.id,
    exercicioId: exercicio.id,
    resposta,
    correto,
  });

  res.json({ correto, respostaCorreta: exercicio.respostaCorreta });
}));


app.get("/api/progresso", exigirLogin, rota(async (req, res) => {
  const registros = await Progresso.findAll({
    where: { usuarioId: req.session.user.id },
    include: { model: Exercicio, as: 'exercicio', include: { model: Categoria, as: 'categoria' } },
  });

  const total = { respondidos: 0, acertos: 0, taxaAcerto: 0 };
  const porCategoria = {};
  const porDificuldade = {};

  //soma uma resposta em um grupo (categoria ou dificuldade)
  const somar = (grupo, chave, r) => {
    grupo[chave] ??= { respondidos: 0, acertos: 0 };
    grupo[chave].respondidos++;
    if (r.correto) grupo[chave].acertos++;
  };

  for (const r of registros) {
    total.respondidos++;
    if (r.correto) total.acertos++;
    somar(porCategoria, r.exercicio?.categoria?.nome ?? "Sem categoria", r);
    somar(porDificuldade, r.exercicio?.dificuldade ?? "Sem nível", r);
  }

  total.taxaAcerto = total.respondidos ? Math.round((total.acertos / total.respondidos) * 100) : 0;

  res.json({ total, porCategoria, porDificuldade });
}));


//-------INICIALIZAÇÃO-------

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
