import express from 'express';
import { Sequelize, DataTypes } from 'sequelize';
import bcrypt from 'bcrypt';
import 'dotenv/config';
import session from 'express-session';


//-------CONFIGURAÇÕES INICIAIS-------

//configuração do express   
const app = express(); 
const PORT = process.env.PORT || 3000;

//converte informações json em objetos javascript
app.use(express.json()); 

//permite acessar os arquivos da pasta static
app.use(express.static('static'));

//prepara a sessão do usuário
app.use(
  session({
    secret: process.env.sessao_user,
    resave: false,
    saveUninitialized: true,
  })
);

//define a página login.html como página inicial (primeira a ser aberta ao rodar o programa)
app.get('/', (req, res) => {
  res.redirect('/login.html');
});


//-------BANCO DE DADOS-------

//configuração do banco de dados
const sequelize = new Sequelize({
    dialect: "sqlite",
    storage: "usuarios.db",
});

//definindo modelo de usuário para o banco de dados
const Usuario = sequelize.define("Usuario", {
  fullname: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  username: { type: DataTypes.STRING, allowNull: false, unique: true },
  password: { type: DataTypes.STRING, allowNull: false },
});

//mantém a tabela atualizada
await sequelize.sync();


//-------CADASTRO DE USUÁRIOS-------

//função de cadastro do usuário
app.post("/cadastrarUser", async (req, res) =>{

    //receber dados enviados pelo formulário e criar as variáveis correspondentes
    const {fullname, email, username, password } = req.body;

    try {
        //criptografar senha e registrar usuário no banco de dados
        const senhaCriptografada = await bcrypt.hash(password,10);
        const novoUsuario = await Usuario.create({
            fullname,
            email,
            username,
            password: senhaCriptografada,
        });

        //envia o resultado da ação para o frontend
        res.status(201).json({ message: "Conta criada com sucesso!"});
    
    }catch(error){
        //verificar se já existe o usuário ou email digitado
        if(error.name ==="SequelizeUniqueConstrainError"){
            //em caso afirmativo, enviar s mensagem de erro para o frontend
            return res.status(400).json({error: "Usuário ou email já cadastrado."});
        }

        //caso ocorra outro erro
        console.error("Erro ao cadastrar", error);
        res.status(500).json({ error: "Erro interno ao cadastrar usuário."});
    }
});

//-------LOGIN DO USUÁRIO-------

//função para logar usuário
app.post("/login", async (req, res) => {

    //receber dados enviados pelo formulário e criar as variáveis correspondentes
    const { username, password } = req.body;

    try {
        //verificar se o nome de usuário digitado existe
        const usuario = await Usuario.findOne({where: {username}});

        //caso o usuário não exista
        if (!usuario) {
            return res.status(401).json({error: "Usuário inválido."});
        }

        //declara a correspondencia de senhas para senha válida
        const senhaValida = await bcrypt.compare(password, usuario.password);

        //caso a senha não corresponda
        if (!senhaValida) {
            return res.status(401).json({ error: "Senha inválida."})
        }
        
        //registra a sessão do usuário
        req.session.user = {
            id: usuario.id,
            username: usuario.username,
            fullname: usuario.fullname,
            email: usuario.email
        };

        res.status(200).json({ message: "Login realizado com sucesso."});
    }catch (error) {
        console.error("Erro no login: ", error);
        res.status(500).json({error: "Erro interno ao realizar login."})
    }

});

//-------INICIALIZAÇÃO-------

//inicializa o servidor
app.listen(PORT, () => {
console.log(`Servidor rodando em http://localhost:${PORT}`);
});
