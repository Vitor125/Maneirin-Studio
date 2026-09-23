# Contexto do Projeto: Maneirin Studio

Atualizado em 23/09/2026. Este é o contexto de referência da versão principal.

## Objetivo e decisões confirmadas

Dois aplicativos web da barbearia Maneirin Studio, Cliente e Barbeiro: apresentação, fotos dos trabalhos, produtos afiliados, consulta de horários e painel interno. Frontend estático em HTML, CSS e JavaScript com módulos ES, Firebase Authentication, Firestore e Hosting. Não há Flask, servidor próprio nem framework de frontend.

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
7. Abre um link de evento no Google Calendar direcionado à conta/agenda principal `maneirinbarbeiro222@gmail.com` (pedido confirmado em 23/09), com duração de 60 minutos, endereço e dados do atendimento. É necessário clicar em **Salvar** no Google Calendar. O painel mantém “Adicionar à agenda” para recuperar uma janela bloqueada ou fechada.

**Limite importante:** não há OAuth nem chamada à API do Google Calendar. O sistema não cria eventos automaticamente, não verifica se foram salvos e não envia lembretes automáticos. Reabrir e salvar o link novamente pode duplicar o evento. Excluir um horário no painel não exclui eventos já salvos no Google.

## Funcionalidades

- Página inicial com apresentação, produtos em carrossel, contatos e seção “Nossos trabalhos”.
- Instagram confirmado pelo usuário em 18/09/2026: **@maneirinbarbeiro**, com link direto para `https://www.instagram.com/maneirinbarbeiro/` na seção Contato e ao lado de WhatsApp/Agendar no início.
- Galeria em carrossel no espaço antes ocupado pelo placeholder ao lado de “Sobre o Studio”. No celular fica abaixo do texto. Fotos e descrições são lidas de `gallery`.
- Fotos da galeria exibidas em formato quadrado (1:1), como solicitado em 18/09/2026, com recorte centralizado e sem distorção no computador e no celular. Os arquivos originais são preservados.
- Painel permite adicionar fotos por arquivo ou URL e remover fotos existentes. Não importa nem duplica as fotos já armazenadas.
- Vitrine completa em `/cliente/produtos/`, com aviso de comissão de afiliado.
- Agenda em `/cliente/agenda/`, com WhatsApp pré-preenchido.
- Login e cadastro por e-mail/senha, aprovação e revogação de barbeiros pelo administrador.
- Cadastro, listagem e remoção de produtos e horários; confirmação de horários e link de calendário.
- Painel com menu lateral escuro e cartões claros no desktop, recuperado do histórico; visual escuro e menu superior no celular.
- Área central organizada em abas **Agenda**, **Fotos**, **Produtos** e **Barbeiros** (somente admin), conforme pedido de 18/09/2026. Uma funcionalidade fica visível por vez; trocar de aba preserva os formulários. Agenda é a aba inicial quando autorizada; caso contrário, abre a primeira área permitida. As setas, Home e End permitem navegação por teclado; alterações de acesso ocultam áreas indisponíveis e limpam formulários/listas. No celular as abas se organizam em duas colunas.
- Administração master em Barbeiros: aprovação, revogação e permissões separadas para Agenda, Fotos e Produtos, aplicadas também no servidor.
- Carrosséis de produtos e fotos sem duplicações e sem avanço horizontal automático. Arraste/toque e teclado percorrem os itens únicos; dica e recorte lateral aparecem apenas quando há conteúdo fora da tela. Flutuação vertical pausa durante interação e respeita movimento reduzido.
- Contato fecha o menu móvel e rola até a seção completa de contatos.
- Dois PWAs independentes na instalação e navegação: Cliente (`/cliente/`) e Barbeiro (`/barbeiro/`). Manifest, identidade, nome, ícones, escopo, cache e offline próprios. Compartilham os dados e regras Firebase; não são origens de segurança separadas. Os dados dinâmicos exigem internet.

## Arquivos e arquitetura

- `public/cliente/index.html`: apresentação, galeria, produtos e contatos.
- `public/cliente/agenda/index.html`: agenda pública.
- `public/cliente/produtos/index.html`: vitrine completa.
- `public/barbeiro/index.html`: acesso e painel interno.
- `public/index.html`, `public/dashboard.html`, `public/agenda/index.html` e `public/produtos/index.html`: compatibilidade com favoritos antigos; o Hosting também redireciona essas rotas.
- `public/script.js`: carregamento e renderização das páginas públicas, galeria e agenda em tempo real.
- `public/dashboard.js`: autenticação, papéis, produtos, galeria, horários e calendário.
- `public/js/firebase.js`: inicialização única de Authentication e Firestore.
- `public/js/utils.js`: escape de HTML, URLs, datas, limites de texto e conversão segura dos documentos.
- `public/js/media.js`: validação compartilhada dos arquivos/links de imagem e tratamento de imagens indisponíveis.
- `public/js/calendar.js`: configuração da agenda, duração e construção do link do Google Calendar.
- `public/js/ui.js`: menu, animações, instalação e registro do service worker compartilhados. O dashboard não importa mais `script.js` nem inicializa as consultas das páginas públicas.
- `public/js/carousel.js`: rolagem manual, itens únicos, indicação de conteúdo oculto, interação e limpeza de observadores.
- `public/js/permissions.js`: contrato compartilhado de acesso por funcionalidade.
- `public/js/admin.js`: cartões da equipe e gravação transacional de papel/permissões.
- `CONFIGURACAO.md`: explicação das configurações JSON, cache e contrato de acesso.
- `public/styles.css`: estilos comuns, responsividade e layout do painel.
- `public/cliente/sw.js` e `public/barbeiro/sw.js`: caches separados (Cliente v5; Barbeiro v3), arquivos e escopos de cada aplicativo. `public/js/sw-runtime.js`: motor comum, rede primeiro, sem dados externos ou autenticação no cache. `public/sw.js`: migração do worker único legado.
- Cada pasta de aplicativo tem `manifest.webmanifest`, `offline.html` e `icons/`. O manifest da raiz preserva a identidade antiga como Cliente; os antigos ícones continuam disponíveis para compatibilidade.
- `public/Fotos/`: logo e quatro fotos locais preservadas do projeto anterior.
- `firebase.json`, `.firebaserc`: Hosting e Firestore do projeto `site-maneirin-studio`.
- `firestore.rules`, `firestore.indexes.json`: permissões e índices (nenhum composto exigido pelas consultas atuais).
- `tests/frontend.test.cjs`: regressões dos fluxos e utilitários, sem dados reais.
- `tests/firestore-rules.cjs`: testes com documentos fictícios no simulador de regras Firebase.
- `tests/service-worker.test.cjs`: regressões do cache, isolamento da autenticação e navegação offline.
- `README.md`, `package.json`, `scripts/check.cjs`: guia de manutenção, comandos de verificação e conferência de sintaxe/imports/configurações. Não há dependências npm nem build.

O arquivo local `.code-workspace` foi preservado, mas é ignorado pelo Git e pelo Hosting. `.qa/` contém artefatos locais de revisão e cópia das regras anteriores; não é publicado nem versionado. `.firebase/` e logs também são locais.

## Dados e acesso

### `users/{uid}`

`email`, `name`, `role`, `createdAt` e, após gestão pelo master, `permissions` com os booleanos `schedules`, `gallery`, `products`. Papéis: `pending`, `barber`, `admin`. Variações históricas em maiúsculas são aceitas pelas regras e normalizadas na interface.

Uma conta só pode criar seu próprio perfil como `pending`, usando o e-mail presente no token autenticado, ler seu próprio perfil e alterar o próprio nome (1–120 caracteres). Apenas admin lê todos os perfis e aprova/revoga outras contas entre `pending` e `barber`; não pode editar e-mails, promover a admin ou apagar seu próprio perfil por essa interface/API cliente. Provisionamento de administrador é uma operação administrativa confiável fora do site. A aprovação/revogação e as permissões são acompanhadas em tempo real. Admin representa o master e mantém acesso integral. Barbeiros legados sem mapa preservam as três áreas até a primeira edição; mapas existentes não podem ser removidos pelo cliente. Uma conta aprovada com todas as permissões falsas não recebe acesso a nenhuma área. Criar perfil usa transação e nunca sobrescreve uma conta existente para `pending`.

### `products/{id}`

`name`, `description`, `image_url`, `affiliate_link`. Leitura pública; escrita por admin ou barbeiro com Produtos. Regras limitam nome a 120, descrição a 2000 e link a 4096 caracteres; exigem tipos e campos previstos.

### `gallery/{id}`

`image_url`, `alt`, `created_at`. Leitura pública; escrita por admin ou barbeiro com Fotos. Regras limitam descrição a 160 caracteres e validam os campos/tipos e o formato do endereço da imagem.

Uploads de produto e galeria aceitam JPG, PNG, WebP, GIF e AVIF de até 600 KB, armazenados como data URL. O navegador verifica se o arquivo realmente carrega como imagem. As regras limitam a string de imagem embutida a 820000 caracteres. Esse limite deixa espaço para a expansão base64 no limite de 1 MiB por documento Firestore. Para arquivos maiores, usar uma URL HTTP/HTTPS. Links e descrições também têm limites no formulário. Não há Firebase Storage integrado para uploads.

### `schedules/{id}`

`barber_name`, `date` (`YYYY-MM-DD`), `time` (`HH:mm:00`), `is_available`; após confirmação também `client_name`, `confirmed_at`, `calendar_id`. Leitura pública somente quando disponível. Reservas com nome de cliente são privadas para admin e barbeiros com Agenda. Gestão compartilhada entre barbeiros autorizados, sem separação por proprietário da vaga.

Novos horários públicos só aceitam os quatro campos de disponibilidade, sem dados de cliente. A atualização permitida é confirmar uma vaga disponível, acrescentando nome (até 120 caracteres), data de confirmação e agenda; não pode alterar data/barbeiro nem sobrescrever ou republicar a reserva. Exclusão exige permissão de Agenda ou papel admin. As regras verificam o formato da data/hora; a validação de data civil possível e futura continua no frontend, inclusive na transação. Não há validação de conflitos entre documentos distintos ou duração de serviços no servidor.

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

- `npm run check`: sintaxe dos quatorze arquivos JavaScript, integridade dos imports locais e leitura das configurações JSON.
- `npm test`: 38 testes locais de frontend e service worker, incluindo agenda, fuso, calendário, HTML/URLs, confirmação, perfil, imagens, login, troca de sessão, revogação e falhas de cache.
- `npm run test:rules`: 101 testes no serviço de simulação, com Firebase CLI instalado e login ativo. Não cria usuários nem reservas reais.
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

## Histórico — revisão de segurança e manutenção, 22/09/2026

**Responsável: Codex (OpenAI), assistente de desenvolvimento.** Revisão solicitada pelo proprietário, iniciada em 18/09 e retomada em 22/09. Base publicada anterior: commit `e7a1775`. Escopo: arquivos-fonte, HTML/CSS, configuração Firebase, regras, testes, cache, fluxos públicos e painel. As fotos e dados reais foram preservados.

### Correções e organização

1. Separados Firebase, utilitários, imagens, calendário e interface comum em cinco módulos. Removida a dependência do dashboard em relação ao script da página pública e unificada a validação de imagens de produtos/galeria.
2. Corrigida a confiança indevida em `id` armazenado no documento: `documentData()` sempre usa o ID real do Firestore. IDs interpolados nos botões agora são escapados, como os demais textos. Regras rejeitam campos extras, inclusive IDs forjados.
3. Reforçadas as regras de perfis, produtos, fotos e horários: tipos, campos permitidos, limites, e-mail vinculado à conta e transição única de disponibilidade para confirmação. Barradas republicação de reserva com nome de cliente e alteração de uma confirmação existente.
4. Respostas assíncronas das listas e conexão são descartadas após troca de usuário/papel. Callbacks antigos de perfil não reabrem o painel depois do logout. Listas e formulários são limpos ao sair/perder acesso; carregamentos de fotos/produtos não gravam após mudança de sessão durante a validação da imagem.
5. Falha de conexão/permissão na inicialização agora mostra erro com opção de tentar novamente; antes podia parecer apenas uma conta aguardando aprovação. Login não permite envios repetidos nem troca de modo durante a solicitação; a senha é limpa após a operação. Falha no logout tem mensagem explícita.
6. URLs de imagem passam por validação ao renderizar. Uploads rejeitam SVG embutido, MIME não permitido, excesso de tamanho e arquivos que não decodificam como imagem. Links com usuário/senha embutidos são rejeitados. Tratamento de imagem quebrada passou de atributos `onerror` para listeners.
7. Adicionados cabeçalhos de CSP, bloqueio de enquadramento por outros sites, `nosniff`, política de referência e restrição de câmera/microfone/localização. Scripts inline são bloqueados; o redirecionamento legado `/barbeiro/` usa o meta refresh existente. Estilos inline continuam permitidos por compatibilidade com o layout atual.
8. Cache v18 inclui os novos módulos, ignora rotas internas de autenticação e evita acumular URLs arbitrárias. Erro de cota/armazenamento não força a exibição de uma versão antiga quando a rede respondeu corretamente.
9. Falha ao abrir a janela do calendário após salvar a confirmação não é apresentada como falha da reserva. O botão de confirmar fica desabilitado durante a operação; o link de recuperação permanece no painel.
10. Menu móvel informa seu estado, fecha com Escape e libera a rolagem ao mudar para desktop. Elementos `hidden` são respeitados mesmo quando estilos definem `display`. Ajustados carrossel de produtos e grade de contatos para evitar largura excedente em telas pequenas. Preservados as abas centrais, fotos quadradas e Instagram confirmado.
11. Criados README de manutenção, comandos npm sem dependências e verificação de sintaxe/imports. Expandida a proteção do Git para arquivos `.env.*`. Nenhuma chave administrativa ou senha foi adicionada ao código.

### Evidências e limites

- 23/23 testes locais e 65/65 testes de regras passaram; os oito arquivos JavaScript e imports locais passaram na verificação de estrutura.
- Prévia com Firebase simulado: abas, login após logout, limpeza de listas, envio de foto, menu e galeria conferidos em desktop e celular. Nenhuma conta, foto de teste ou compromisso foi criado no banco real.
- Consulta administrativa somente de leitura em 22/09: 2 perfis (1 admin, 1 barber), 4 fotos, 1 produto e 0 horários. A contagem de três fotos registrada acima refere-se à auditoria anterior de 18/09.
- As regras novas não migram dados antigos; registros legados continuam legíveis/removíveis conforme a permissão. Limites de leitura/custo em grande escala, armazenamento dedicado de imagens, deduplicação de horários e integração automática com Calendar exigem evolução própria. Não foi alterada a configuração de contas, OAuth, App Check, quotas ou IAM fora dos arquivos do projeto.
- Referência técnica para validação de campos: https://firebase.google.com/docs/firestore/security/rules-fields . As conclusões desta revisão são sustentadas também pelos testes do próprio projeto; não equivalem a uma garantia de ausência de qualquer vulnerabilidade.

Publicação em 22/09/2026 concluída no Firebase Hosting e nas regras Firestore, com compilação aprovada. A conferência HTTP comparou 16 arquivos publicados com a cópia local e verificou os cabeçalhos de segurança na página inicial, painel, agenda e produtos. A galeria permaneceu pública (4 registros) e os perfis continuaram bloqueados para leitura anônima (403). No navegador real, dados públicos e alternância login/cadastro carregaram sem erros de console. A revisão, os testes e este registro são versionados juntos na branch `main`; a cópia local permanece no diretório `A:\site-maneirin-studio`.

## Histórico — carrosséis, administração master e comentários, 23/09/2026

**Responsável: Codex (OpenAI), assistente de desenvolvimento.** Continuação autorizada pelo proprietário, a partir da revisão publicada `4fa145c`.

- Substituídos os carrosséis com setas por faixas contínuas de produtos/fotos, com próximo item parcialmente visível. Cópias são apenas de apresentação, sem novos registros no banco. Adicionados arraste por mouse, toque nativo, teclado, pausas e respeito a movimento reduzido. Fotos permanecem quadradas.
- Adicionado Instagram no início, ao lado de WhatsApp e Agendar. Corrigida a navegação Contato para fechar o menu móvel e alcançar os contatos.
- Criada a administração master dentro da aba central Barbeiros, com seleção independente de Agenda, Fotos e Produtos, aprovação/revogação, atualização da lista e mensagens de erro. A conta master existente foi preservada; não foram criadas credenciais nem alteradas permissões reais durante testes.
- Permissões verificadas em ações, consultas privadas, abas e regras Firestore. Alterações ao vivo invalidam respostas pendentes e limpam dados/formulários. Transação protege contra sobrescrita concorrente, inclusive escolhas salvas em perfil pendente. Nenhuma conta pode se promover ou conceder permissões a si mesma.
- Separados os módulos de permissões, administração e carrosséis. Cache atualizado para v20 e inclui os novos módulos.
- Documentadas funções, responsabilidades, eventos importantes, HTML, seções CSS, regras e cache. Criado CONFIGURACAO.md para explicar arquivos JSON sem inserir comentários inválidos. README atualizado.

Validação: 31 testes locais e 101 testes de regras aprovados. Verificação de sintaxe/imports/configuração aprovada para 11 arquivos JavaScript. Prévia isolada com dados fictícios confirmou salvamento de permissões, exibição exclusiva de Fotos para conta restrita, painel em tela móvel, carrosséis contínuos em ambos os sentidos, fotos quadradas, Instagram e navegação Contato. Não foram criados compromissos ou usuários de teste no Firebase real.

Publicação em 23/09/2026 concluída no Firebase Hosting e regras Firestore, com compilação aprovada. A conferência comparou 19 arquivos publicados com a cópia local, verificou cabeçalhos de segurança em quatro rotas e confirmou galeria pública (4 registros) e perfis bloqueados para leitura anônima (403). No site publicado, carrosséis carregaram, Instagram apareceu no início, Contato alcançou os contatos/rodapé e o painel exibiu o login. O console da página pública não registrou erros nesta verificação. Código, comentários, testes e documentação seguem juntos na branch main do GitHub e na cópia local.

## Histórico — separação dos aplicativos, 23/09/2026

**Responsável: Codex (OpenAI).** A pedido do proprietário, Cliente e Barbeiro passaram a ser PWAs com identidades e escopos sem sobreposição. Cliente abre em `/cliente/` e mantém apresentação, fotos, agenda e produtos. Barbeiro abre em `/barbeiro/` e mantém login, abas e administração master.

- Criados manifests, nomes, ícones C/B, instalação, caches e páginas offline próprios. Removido o atalho de barbeiro do manifest do cliente. Links públicos do painel abrem fora dele.
- Migradas as páginas para diretórios próprios, preservando módulos comuns e regras de acesso. A página inicial e favoritos antigos redirecionam para o aplicativo correspondente.
- Criado motor comum de service worker com cache isolado por prefixo: atualizar um app não remove os arquivos do outro; o fallback offline não captura a navegação do outro. Worker raiz antigo foi convertido em migração, e o registro novo retira o escopo raiz legado.
- O ID original `/` permanece no Cliente para atualização das instalações existentes. Alteração de nome/ícone pode depender do navegador ou reinstalação. Instalação no sistema operacional não foi executada pelo agente.
- Os apps permanecem na mesma origem e projeto Firebase para sincronizar horários e conteúdo. A independência é de instalação, abertura, navegação e cache; não equivale a isolamento de origem ou a bancos separados.
- 38 testes locais aprovados, incluindo isolamento de caches, atualização, fallback, identidades e migração. Sintaxe/imports/configuração de 14 arquivos JavaScript aprovados. As regras permanecem idênticas à revisão de 101 testes já aprovada. Prévia isolada conferiu cliente/agenda, favoritos antigos, painel master e manifests vinculados sem erros de console.

Referência para os escopos sem sobreposição: https://web.dev/articles/building-multiple-pwas-on-the-same-domain .

### Complementos solicitados na mesma revisão

- Conferidos novamente carrosséis contínuos sem setas visuais, próximo item parcialmente visível, Instagram no início e Contato até a seção de contatos. Essas funcionalidades da revisão anterior foram mantidas dentro de Cliente.
- Agenda Google passou a usar `maneirinbarbeiro222@gmail.com` em `src` e `authuser`, substituindo a agenda de grupo anterior. Teste valida os dois parâmetros. A tela informa qual conta deve estar aberta e mantém a instrução de Salvar. Não foi acessada a conta Google real nem criado evento de teste.
- Código novo mantém comentários de responsabilidades, migração, escopo, cache e calendário. Configurações JSON continuam documentadas em CONFIGURACAO.md.
- Revalidação HTTP ampliada às rotas sem extensão e manifests. Cache do Barbeiro atualizado para v2 após a alteração de calendário.

Publicação final desta revisão concluída em 23/09/2026 no Firebase Hosting. Conferência HTTP: 36 arquivos publicados idênticos à cópia local, nove redirecionamentos antigos corretos, tipos de conteúdo dos manifests/workers e cabeçalhos verificados para os dois apps. No navegador publicado, Cliente carregou seus dados e carrosséis sem erros de console, Contato alcançou a seção e o rodapé, e Barbeiro exibiu seu login próprio. A primeira abertura com cache legado exigiu recarregamento; depois carregou a entrada nova. A versão foi preparada para sincronização na main junto com testes, comentários e este histórico.

## Histórico — localização confirmada, 23/09/2026

**Responsável: Codex (OpenAI).** O proprietário confirmou https://maps.app.goo.gl/23gyeFuJq7AkSn9i6 como referência oficial do Maneirin Studio. A consulta ao perfil no Maps confirmou R. Nilópolis, 352 - Éden, São João de Meriti - RJ, 25535-050. O contato do site já usava esse link; acrescentado o nome do estabelecimento junto ao endereço. Os novos links de evento incluem o nome do Studio no local e o link exato do Maps na descrição, mantendo a conta maneirinbarbeiro222@gmail.com. Eventos já salvos no Google não são alterados. Caches atualizados para Cliente v2 e Barbeiro v3.

Validação: 38 testes locais e verificação dos 14 arquivos JavaScript aprovados. Publicação no Firebase Hosting concluída; os quatro arquivos alterados de aplicação foram comparados com a cópia local e estão idênticos.

## Histórico — carrosséis flutuantes, 23/09/2026

**Responsável: Codex (OpenAI).** A pedido do proprietário, fotos e produtos receberam oscilação vertical suave, sombras e desaparecimento gradual nas extremidades. Mantido o deslocamento horizontal infinito e o próximo item parcialmente visível. A flutuação pausa durante hover/foco e é desativada com preferência por movimento reduzido. Cópias herdam a fase da animação do original para preservar a continuidade. Adicionado espaço vertical para não cortar cartões e sombras; cache Cliente atualizado para v3.

Verificação de sintaxe/imports dos 14 arquivos JavaScript e configurações aprovada. Publicado no Firebase Hosting.

## Histórico — indicação de mais fotos, 23/09/2026

**Responsável: Codex (OpenAI).** Adicionada abaixo da galeria a indicação discreta 'Deslize para ver mais fotos', acompanhada de pontos decorativos, sem setas. Só aparece quando há ao menos duas fotos originais válidas; cópias do carrossel não entram na contagem. Layout ajustado para posicionar a indicação abaixo da faixa. Cache Cliente v4. Sintaxe/imports verificados e alteração publicada no Firebase Hosting. Sincronização GitHub permanece aguardando autorização solicitada anteriormente.


## Histórico — conteúdo sem repetição, 23/09/2026

**Responsável: Codex (OpenAI).** Correção solicitada: removida a clonagem de fotos/produtos e o avanço horizontal automático. Cada registro aparece uma única vez. Mantidos arraste, toque, teclado, sombras e flutuação. Próximo item parcial e dica de deslizar indicam apenas conteúdo real fora da tela; faixa sem overflow fica centralizada e sem dica. Extremidades esmaecem somente onde há conteúdo oculto. Esta decisão substitui o loop infinito anterior. Cache Cliente v5. GitHub segue aguardando a autorização anterior.

## Histórico — documentação e sincronização autorizada, 23/09/2026

**Responsável: Codex (OpenAI).** Proprietário autorizou explicitamente atualizar a máquina e comitar todas as alterações no GitHub. Revisados os comentários dos módulos, regras, páginas, estilos e testes. Completadas as explicações das pistas de navegação, arraste, teclado e limpeza do carrossel. README, configuração e resumo atual do contexto agora descrevem itens únicos e cache Cliente v5; JSON é explicado em CONFIGURACAO.md para preservar sua validade. Os registros históricos anteriores permanecem como histórico. Cópia local em A:\site-maneirin-studio. Validação: 14 arquivos JavaScript/configurações e 38 testes locais aprovados; regras Firestore não alteradas nesta revisão.
