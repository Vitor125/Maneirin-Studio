# Contexto do Projeto: Maneirin Studio

Atualizado em 18/09/2026. Este é o contexto de referência da versão principal.

## Objetivo e decisões confirmadas

Site da barbearia Maneirin Studio: apresentação, fotos dos trabalhos, produtos afiliados, consulta de horários e painel interno. Frontend estático em HTML, CSS e JavaScript com módulos ES, Firebase Authentication, Firestore e Hosting. Não há Flask, servidor próprio nem framework de frontend.

A revisão confrontou o código local, o histórico de `main` (base `f0bdce6`) e a branch `agents/context-update-and-appointment-reminder` (`e31465b`, 13/09/2026). O contexto local dizia que a galeria havia sido cancelada; a branch alternativa tinha galeria, reserva pública transacional e outro layout. Em 18/09, o usuário decidiu explicitamente:

- O cliente escolhe um horário no site e segue para o WhatsApp.
- O barbeiro combina com o cliente e confirma pelo dashboard, retirando a disponibilidade.
- Na confirmação, abre o Google Calendar com o evento preenchido.
- Recuperar a galeria no espaço ao lado de “Sobre o Studio” e o layout alternativo do painel.

A decisão atual substitui o cancelamento antigo da galeria. Não foi recuperada a reserva automática feita pelo visitante na branch alternativa.

## Fluxo de agendamento implementado

1. O barbeiro publica nome, data e horário com `is_available: true`.
2. A agenda pública consulta apenas disponibilidade explícita, filtra datas válidas e futuras e ordena por data/hora. Os horários usam o fuso do Studio (São Paulo, UTC−03), independentemente do fuso do visitante.
3. “Agendar” abre o WhatsApp do Studio (`5521980453636`) com barbeiro, data e hora na mensagem. Este clique não bloqueia nem confirma a vaga.
4. Depois do acordo no WhatsApp, o barbeiro usa “Confirmar” no painel e informa o nome do cliente.
5. Uma transação relê a vaga e só confirma se ela continua disponível e futura. Grava `client_name`, `confirmed_at`, `calendar_id` e `is_available: false`.
6. A agenda pública recebe a atualização em tempo real e remove a vaga. Uma atualização a cada minuto também retira horários que acabaram de expirar.
7. Abre um link de evento no Google Calendar, com duração de 60 minutos, endereço e dados do atendimento. É necessário clicar em **Salvar** no Google Calendar. O painel mantém “Adicionar à agenda” para recuperar uma janela bloqueada ou fechada.

**Limite importante:** não há OAuth nem chamada à API do Google Calendar. O sistema não cria eventos automaticamente, não verifica se foram salvos e não envia lembretes automáticos. Reabrir e salvar o link novamente pode duplicar o evento. Excluir um horário no painel não exclui eventos já salvos no Google.

## Funcionalidades

- Página inicial com apresentação, produtos em carrossel, contatos e seção “Nossos trabalhos”.
- Instagram confirmado pelo usuário em 18/09/2026: **@maneirinbarbeiro**, com link direto para `https://www.instagram.com/maneirinbarbeiro/` na seção Contato.
- Galeria em carrossel no espaço antes ocupado pelo placeholder ao lado de “Sobre o Studio”. No celular fica abaixo do texto. Fotos e descrições são lidas de `gallery`.
- Fotos da galeria exibidas em formato quadrado (1:1), como solicitado em 18/09/2026, com recorte centralizado e sem distorção no computador e no celular. Os arquivos originais são preservados.
- Painel permite adicionar fotos por arquivo ou URL e remover fotos existentes. Não importa nem duplica as fotos já armazenadas.
- Vitrine completa em `/produtos/`, com aviso de comissão de afiliado.
- Agenda em `/agenda/`, com WhatsApp pré-preenchido.
- Login e cadastro por e-mail/senha, aprovação e revogação de barbeiros pelo administrador.
- Cadastro, listagem e remoção de produtos e horários; confirmação de horários e link de calendário.
- Painel com menu lateral escuro e cartões claros no desktop, recuperado do histórico; visual escuro e menu superior no celular.
- Área central organizada em abas **Agenda**, **Fotos**, **Produtos** e **Barbeiros** (somente admin), conforme pedido de 18/09/2026. Uma funcionalidade fica visível por vez; trocar de aba preserva os formulários. Agenda é a aba inicial. As setas, Home e End permitem navegação por teclado; perder permissão de admin oculta Barbeiros e retorna para Agenda quando necessário. No celular as abas se organizam em duas colunas.
- PWA com manifest, ícones, instalação quando suportada, cache do conteúdo estático e página offline. Os dados dinâmicos exigem internet.

## Arquivos e arquitetura

- `public/index.html`: apresentação, galeria, produtos e contatos.
- `public/agenda/index.html`: agenda pública.
- `public/produtos/index.html`: vitrine completa.
- `public/dashboard.html`: acesso e painel interno.
- `public/barbeiro/index.html`: redireciona para o dashboard; preserva o atalho do PWA.
- `public/script.js`: inicialização única do Firebase, utilitários, páginas públicas, galeria, agenda em tempo real e registro do service worker.
- `public/dashboard.js`: autenticação, papéis, produtos, galeria, horários e calendário.
- `public/styles.css`: estilos comuns, responsividade e layout do painel.
- `public/sw.js`: cache `maneirin-studio-v17`, rede primeiro, sem cache de requisições externas ao site (incluindo dados e autenticação do Firebase).
- `public/manifest.webmanifest`, `public/offline.html`, `public/icons/`: instalação e experiência offline.
- `public/Fotos/`: logo e quatro fotos locais preservadas do projeto anterior.
- `firebase.json`, `.firebaserc`: Hosting e Firestore do projeto `site-maneirin-studio`.
- `firestore.rules`, `firestore.indexes.json`: permissões e índices (nenhum composto exigido pelas consultas atuais).
- `tests/frontend.test.cjs`: regressões dos fluxos e utilitários, sem dados reais.
- `tests/firestore-rules.cjs`: testes com documentos fictícios no simulador de regras Firebase.

O arquivo local `.code-workspace` foi preservado, mas é ignorado pelo Git e pelo Hosting. `.qa/` contém artefatos locais de revisão e cópia das regras anteriores; não é publicado nem versionado. `.firebase/` e logs também são locais.

## Dados e acesso

### `users/{uid}`

`email`, `name`, `role`, `createdAt`. Papéis: `pending`, `barber`, `admin`. Variações históricas em maiúsculas são aceitas pelas regras e normalizadas na interface.

Uma conta só pode criar seu próprio perfil como `pending`, ler seu próprio perfil e alterar o próprio nome. Apenas admin lê todos os perfis e altera cargos. A aprovação/revogação é acompanhada em tempo real. Criar perfil usa transação e nunca sobrescreve uma conta existente para `pending`.

### `products/{id}`

`name`, `description`, `image_url`, `affiliate_link`. Leitura pública; escrita por barbeiro/admin.

### `gallery/{id}`

`image_url`, `alt`, `created_at`. Leitura pública; escrita por barbeiro/admin.

Uploads de produto e galeria aceitam imagens de até 600 KB, armazenadas como data URL. Esse limite deixa espaço para a expansão base64 no limite de 1 MiB por documento Firestore. Para arquivos maiores, usar uma URL HTTP/HTTPS. Não há Firebase Storage integrado para uploads.

### `schedules/{id}`

`barber_name`, `date` (`YYYY-MM-DD`), `time` (`HH:mm:00`), `is_available`; após confirmação também `client_name`, `confirmed_at`, `calendar_id`. Leitura pública somente quando disponível. Reservas com nome de cliente são privadas para barbeiros/admins. Gestão compartilhada entre barbeiros autorizados, sem separação por proprietário da vaga.

As coleções históricas `photos` e `appointments` não são usadas nesta versão e não possuem acesso pelas regras atuais. Nenhum registro foi excluído durante a auditoria.

## Correções desta revisão

- Fechada a possibilidade de cadastrar ou promover a própria conta para admin.
- Restringida a leitura de perfis e de horários confirmados.
- Retirado código morto da antiga coleção `photos`; recuperada a galeria consistente da branch histórica.
- Corrigidos horários inválidos, expirados, disponibilidade indefinida e fuso do visitante.
- Confirmação transacional evita sobrescrever uma vaga já confirmada por outro barbeiro.
- Evitada disputa entre cadastro e inicialização do perfil; botão de login é liberado após sucesso/erro.
- Tratados erros de aprovação/revogação; papéis desconhecidos não liberam o painel.
- Limite de imagem ajustado ao Firestore; URLs de produto/imagem validadas.
- Formulários desativam o envio durante gravação, evitando cliques repetidos.
- Cache atualizado e arquivos locais do editor excluídos do Hosting.
- Ajustes de contraste e largura em desktop/celular.

## Validação e operação

- `node --check public/script.js`, `node --check public/dashboard.js`, `node --check public/sw.js`.
- `node --test tests/frontend.test.cjs`: 9 testes de agenda, fuso, calendário, escape de HTML/URL, confirmação, perfil, tamanho/link de imagem e login.
- `node tests/firestore-rules.cjs`: 32 testes no serviço de simulação, com Firebase CLI instalado e login ativo. Não cria usuários nem reservas reais.
- `firebase deploy --only firestore:rules --project site-maneirin-studio --dry-run --non-interactive`: compilação de regras.
- Revisão visual em 1440 px e 390 px; cadastro de foto/horário validado com Firebase simulado na máquina.
- Publicar com `firebase deploy --only hosting,firestore:rules --project site-maneirin-studio --non-interactive`.
- Site: https://site-maneirin-studio.web.app
- GitHub: https://github.com/Vitor125/Maneirin-Studio

Publicação de 18/09/2026 concluída no Firebase Hosting e nas regras Firestore. A conferência HTTP confirmou que os nove arquivos principais publicados são idênticos aos locais, que as três fotos estão acessíveis publicamente e que a leitura anônima de perfis retorna 403.

A leitura de produção durante a auditoria encontrou 1 admin, 1 barbeiro, 3 fotos, 1 produto e nenhum horário cadastrado. Por isso a agenda vazia é esperada até o cadastro de novas disponibilidades. Os testes de confirmação e cadastro foram feitos com dados fictícios, sem criar compromissos reais.

Uma das três entradas antigas de galeria contém um link de postagem Instagram, não um arquivo de imagem. A entrada foi preservada no banco; a interface pública omite imagens que falham e o painel informa quais precisam ser substituídas. Novos links de foto/produto são carregados como imagem para validação antes da gravação. URLs temporárias de redes sociais podem expirar; upload de arquivo é mais durável.

## Pendências reais

- Integração automática do Google Calendar requer autorização OAuth/API e definição de qual agenda recebe cada atendimento.
- Lembretes automáticos, cancelamento/reagendamento sincronizado e conta de cliente continuam fora desta implementação.
- Não existe tabela de preços/serviços cadastrável; não inventar preços nem serviços.
- Senha real do barbeiro e salvamento final na conta Google não foram usados nos testes. Esses passos dependem da sessão do proprietário.

Antes de continuar, preserve o fluxo aprovado acima. Não reintroduza a reserva pública automática da branch antiga sem nova decisão. Atualize este documento sempre que o escopo mudar.
