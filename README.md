# 🌱 GERMINA - Sistema de Tabela de Preços

## 📋 **O QUE FOI CRIADO**

✅ **Banco de dados completo** (database-structure.sql)
✅ **Interface HTML** (index.html)
✅ **Estilos CSS** (styles.css)
✅ **Configuração** (config.js)

---

## 🚀 **INSTALAÇÃO RÁPIDA**

### **Passo 1: Banco de Dados**
Você já executou! ✅

### **Passo 2: Criar Repositório no GitHub**

```bash
# Criar novo repositório
git init
git add .
git commit -m "Projeto Germina - inicial"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/germina.git
git push -u origin main
```

### **Passo 3: Deploy no Vercel**

1. Acesse **vercel.com**
2. **New Project**
3. Conecte com o GitHub
4. Selecione o repositório **germina**
5. Deploy!

---

## 📁 **ESTRUTURA DE ARQUIVOS**

```
germina/
├── index.html          # Página principal
├── styles.css          # Estilos
├── config.js           # Configuração do Supabase
├── app.js              # JavaScript principal (VOCÊ PRECISA CRIAR)
└── README.md           # Este arquivo
```

---

## ⚠️ **JAVASCRIPT PENDENTE**

Devido ao limite de tokens, não consegui criar o arquivo `app.js` completo.

Você tem **2 opções**:

### **Opção 1: Pedir em uma nova conversa**
Abra uma nova conversa comigo e diga:
"Crie o arquivo app.js para o sistema Germina com todas as funções"

### **Opção 2: Usar o painel admin anterior**
O `admin-login.html` que criamos funciona! Você pode:
1. Usar ele enquanto desenvolve o completo
2. Copiar as funções de lá para o novo

---

## 🎯 **FUNCIONALIDADES DO APP.JS**

O app.js precisa ter:

1. **Autenticação**
   - Login/logout
   - Verificação de admin
   
2. **Categorias**
   - Listar
   - Criar
   - Editar
   - Deletar
   
3. **Produtos**
   - Listar por categoria
   - Criar
   - Editar
   - Deletar
   - Importar do Excel
   
4. **Estoque**
   - Listar
   - Atualizar
   - Importar do Excel
   
5. **Avisos**
   - Listar
   - Criar
   - Editar
   - Deletar
   - Toggle ativo/inativo
   
6. **Usuários**
   - Listar
   - Criar
   - Gerenciar roles

---

## 📚 **BIBLIOTECAS NECESSÁRIAS**

Para importar Excel, adicione no HTML:

```html
<script src="https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js"></script>
```

---

## 🔑 **CREDENCIAIS**

- **Supabase URL:** https://igbvisxkwxfyftfdhotq.supabase.co
- **Anon Key:** (já está no config.js)
- **Email Admin:** willian.f.gomes@hotmail.com

---

## 🎨 **DESIGN**

Cores principais:
- Verde: #2E7D32
- Fundo: #F5F5F5
- Branco: #FFFFFF

---

## 📞 **PRÓXIMOS PASSOS**

1. ✅ Estrutura HTML criada
2. ✅ CSS completo
3. ⏳ **Criar app.js** (pendente)
4. ⏳ Testar funcionalidades
5. ⏳ Deploy final

---

## 💡 **DICA**

O mais importante agora é criar o **app.js**. 

Peça em uma nova conversa:
"Crie o app.js completo para o Germina com:
- Autenticação
- CRUD de categorias
- CRUD de produtos  
- Import Excel
- CRUD de avisos
- Gestão de usuários"

---

**Criado com ❤️ por Claude**
