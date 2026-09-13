# CONTEXTO MESTRE DO PROJETO

## 1. Visão geral

O Maneirin Studio é um site de barbearia hospedado no Firebase Hosting. O frontend é composto por HTML, CSS e JavaScript nativo carregado diretamente de `public/`. O Firebase Authentication protege o painel interno e o Cloud Firestore armazena produtos, horários, usuários e agendamentos.

Este documento confronta o histórico recebido em 13/09/2026 com os arquivos atuais do repositório. O código atual é a principal evidência do estado implementado.

## 2. Objetivo do projeto

Divulgar o Maneirin Studio, permitir consulta de horários e contato, exibir produtos afiliados e oferecer uma área autenticada para barbeiros/administração. O objetivo funcional mais recente é transformar o clique em “Agendar” em uma reserva real, remover o horário da agenda pública e criar mecanismos de lembrete para cliente e barbeiro.

## 3. Histórico e evolução

- O pedido inicial do histórico foi uma auditoria completa de segurança, bugs, organização, arquitetura, frontend, backend e legibilidade.
- Também foi pedido que o código fosse comentado, embora a regra atual de manutenção seja comentar apenas trechos que precisem de esclarecimento.
- O histórico exigiu um arquivo mestre para outra IA, sem inventar arquivos, tabelas, endpoints ou decisões não confirmadas.
- O site evoluiu de uma agenda que apenas montava uma mensagem do WhatsApp para um fluxo de reserva no Firestore.
- O projeto adotou Firebase SDK, Authentication, Firestore e Hosting. A configuração atual confirma o projeto `site-maneirin-studio` e a região `southamerica-east1`.
- A referência ao projeto do Mevam que possui uma livraria foi solicitada, mas não foi fornecido neste repositório um link, código ou especificação verificável dessa referência. Não há integração confirmada com o projeto Mevam.

## 4. Sistemas existentes

### Site público

Landing page em `public/index.html`, com hero, apresentação, contato, WhatsApp, localização, produtos afiliados e acesso à agenda.

### Agenda pública

`public/agenda/index.html` consulta `schedules` e exibe somente documentos cujo `is_available` não seja `false`. O visitante seleciona um horário, informa nome e WhatsApp, e confirma a reserva.

### Sistema de agendamento

Implementado em `public/script.js`:

1. O visitante escolhe um horário disponível.
2. O formulário valida nome e telefone no navegador.
3. Uma transação Firestore lê o horário.
4. Se ele ainda estiver disponível, grava `appointments/{scheduleId}` e atualiza o horário para `is_available: false`.
5. Se outro cliente tiver reservado primeiro, a transação falha e o visitante recebe uma mensagem.
6. A agenda é recarregada, removendo o horário da listagem pública.

O identificador do agendamento é o identificador do horário. Isso cria uma restrição única natural: somente uma reserva pode ocupar cada horário.

### Lembretes e confirmação

Após a reserva, o cliente recebe:

- link para criar um evento no Google Calendar;
- link para enviar uma confirmação pelo WhatsApp.

O painel do barbeiro exibe os agendamentos confirmados e fornece um link de evento no Google Calendar para adicionar o atendimento à agenda. Também é oferecido um link de WhatsApp para avisar o barbeiro na confirmação do cliente.

**Limitação confirmada:** não existe backend agendado, Cloud Function, provedor de SMS/e-mail ou push notification. Os lembretes dependem da ação de abrir o link e adicionar o evento/enviar a mensagem. Um lembrete automático exigirá uma integração posterior.

### Painel interno

`public/dashboard.html` e `public/dashboard.js` permitem:

- login e cadastro via Firebase Authentication;
- criação de usuário com papel `pending`;
- aprovação/revogação de barbeiros por admin;
- criação e remoção de horários;
- cadastro e remoção de produtos;
- visualização dos agendamentos confirmados.

### Produtos afiliados

Produtos são lidos publicamente de `products` e gerenciados no painel. Imagens podem ser data URL de arquivo pequeno ou URL externa. Links externos são validados para HTTP/HTTPS antes da renderização.

## 5. Arquitetura

```text
Navegador
  ├── Firebase Authentication ── usuários do painel
  ├── Cloud Firestore
  │     ├── users
  │     ├── products
  │     ├── schedules
  │     └── appointments
  └── Links externos
        ├── WhatsApp
        └── Google Calendar

Firebase Hosting
  └── public/
```

Não existe servidor próprio ou API REST no repositório. O `firebase.json` configura Hosting, Firestore, regras e índices.

## 6. Estrutura de arquivos confirmada

```text
/
├── CONTEXTO-MESTRE.md
├── firebase.json
├── firestore.rules
├── firestore.indexes.json
├── .firebaserc
└── public/
    ├── index.html
    ├── dashboard.html
    ├── dashboard.js
    ├── script.js
    ├── styles.css
    ├── sw.js
    ├── manifest.webmanifest
    ├── offline.html
    ├── agenda/index.html
    ├── barbeiro/index.html
    ├── produtos/index.html
    ├── Fotos/
    └── icons/
```

## 7. Banco de dados

### `users/{userId}`

Campos observados: `email`, `name`, `role`, `createdAt`. Papéis usados pelo código: `pending`, `barber` e `admin`, com variações de caixa aceitas nas regras.

### `products/{productId}`

Campos observados: `name`, `description`, `image_url`, `affiliate_link`.

### `schedules/{scheduleId}`

Campos observados: `barber_name`, `date` (`YYYY-MM-DD`), `time`, `is_available`. Após reserva, também recebe `appointment_id`.

### `appointments/{scheduleId}`

Campos gravados pelo fluxo atual: `schedule_id`, `barber_name`, `date`, `time`, `client_name`, `client_phone`, `client_email`, `created_at`.

Não foram encontrados scripts de migração ou documentação de dados além das regras atuais.

## 8. Regras de negócio e segurança

- Horários com `is_available: false` não aparecem na agenda pública.
- Um horário só pode ser reservado se ainda estiver disponível.
- A reserva e a indisponibilidade do horário são gravadas na mesma transação.
- Cliente não autenticado pode criar uma reserva validada, mas não pode ler ou alterar dados de clientes.
- Apenas barbeiro/admin pode gerenciar produtos, horários e consultar agendamentos.
- Leitura de produtos e horários é pública.
- Dados recebidos no frontend são escapados antes de serem inseridos em HTML.
- Links externos aceitam somente `http:` e `https:`.
- A disponibilidade real da reserva depende das regras publicadas no Firestore; alterações em `firestore.rules` precisam ser implantadas.

## 9. Funcionalidades concluídas

- Landing page responsiva e navegação.
- PWA básico com manifest, service worker e página offline.
- Agenda pública baseada em Firestore.
- Painel com autenticação e aprovação de barbeiros.
- CRUD de horários e produtos no painel.
- Reserva transacional de horário.
- Ocultação do horário reservado da agenda pública.
- Registro de atendimento em `appointments`.
- Link de evento para o Google Calendar do cliente e do barbeiro.
- Links de confirmação/aviso por WhatsApp.
- Atualização do cache do service worker para a versão `v9`.
- Este arquivo de contexto mestre.
- Corrigido um erro que havia colocado as funções de calendário/agendamento dentro de `safeExternalUrl`.
- Reforçadas as regras para exigir horário existente, disponível e correspondente aos dados da reserva.
- Corrigido o carregamento da página de produtos: `public/produtos/index.html` agora carrega `script.js` como módulo ES, permitindo os imports do Firebase e a consulta de `products`.
- Corrigida a validação da reserva Firestore: a regra agora usa `getAfter()` para validar a escrita da reserva na mesma transação, e o agendamento grava o horário no mesmo formato de `schedules` (`HH:mm:00`).
- Limpo o painel: `loadDashboardAppointments()` foi removida de dentro de `loadDashboardSchedules()`, evitando referência fora de escopo, e as ações de aprovar/revogar barbeiros passaram a tratar erros e informar o resultado.
- Corrigido o espaço visual vazio da seção “Sobre”: a coluna de imagem foi removida, sem reservar altura para placeholder ou foto.
- Criada a coleção pública `gallery`, um carrossel compacto na seção “Sobre” e uma seção “Fotos do Studio” no painel para upload/link, descrição e remoção de fotos.
- A seção de fotos foi movida para o início do painel autenticado e o cache do PWA foi atualizado para `v10`, evitando que a interface fique escondida por uma versão antiga.
- Após a publicação, foi identificado cache antigo do service worker no dashboard; `dashboard.js` passou a usar query string `v=11` e o cache foi atualizado para `v11`.
- O gerenciamento de barbeiros foi ajustado para telas pequenas: cada usuário passa a ocupar um cartão vertical, com e-mail quebrando linha e ações em largura total.

## 10. Funcionalidades pendentes

- Implementar lembretes automáticos reais antes do atendimento (Cloud Functions/Cloud Scheduler e provedor de e-mail, WhatsApp Business API, SMS ou push).
- Definir política de cancelamento, reagendamento e expiração de reservas.
- Confirmar se o barbeiro deve receber o evento automaticamente em uma agenda compartilhada, em vez de adicioná-lo pelo link.
- Validar e publicar as regras no projeto Firebase de produção.
- Criar testes automatizados de regras Firestore e do fluxo de concorrência.
- Definir retenção, proteção e consentimento para dados pessoais dos clientes.
- Confirmar a referência visual/funcional do projeto Mevam, pois nenhum artefato verificável foi fornecido.

## 11. Problemas e limitações conhecidos

- O lembrete atual é assistido por links; não é uma notificação automática.
- O cliente pode fechar a confirmação sem adicionar o evento ou enviar o WhatsApp.
- Não há fluxo de cancelamento ou notificação de alteração.
- Não há índice Firestore configurado; as consultas atuais não exigem índice composto.
- Credenciais Firebase do frontend são configuração pública normal do SDK, mas regras e Authentication continuam sendo a barreira de autorização.
- A razão histórica de algumas decisões de design e da referência ao Mevam não está disponível.

## 12. Decisões importantes

- Manter Firebase como backend atual.
- Manter Firestore como fonte de verdade para disponibilidade.
- Usar transação e documento de agendamento com o mesmo ID do horário para impedir dupla reserva.
- Não expor dados pessoais de `appointments` publicamente.
- Usar Google Calendar e WhatsApp como lembretes assistidos enquanto uma integração automática não existir.
- Preservar a estrutura estática atual, sem introduzir framework ou dependência não confirmada.

## 13. Decisões descartadas ou não confirmadas

- Não foi confirmada uma API própria.
- Não foi confirmado envio automático de e-mail, SMS ou WhatsApp Business.
- Não foi confirmado uso de banco diferente do Firestore.
- Não foi confirmada integração técnica com o projeto Mevam/livraria.
- Não há evidência de que horários devam permanecer visíveis como “reservados”; a decisão implementada é removê-los da agenda pública.

## 14. Estado atual

O fluxo de ponta a ponta está implementado no frontend e nas regras locais: publicar horários, exibir disponibilidade, reservar uma vez, salvar o atendimento, retirar o horário público e oferecer lembretes assistidos. O painel consegue consultar os agendamentos e adicioná-los à agenda do barbeiro.

O próximo passo recomendado é publicar/testar as regras no Firebase real e validar uma reserva concorrente em dois navegadores. Depois, escolher e implementar um provedor de lembretes automáticos e os fluxos de cancelamento/reagendamento.

## 15. Contexto para outra IA

Você está assumindo um projeto que já possui desenvolvimento anterior. Antes de modificar qualquer coisa, compreenda o contexto abaixo.

O projeto é um site estático de barbearia em Firebase Hosting. O frontend está em `public/`, usa JavaScript nativo e importa o SDK Firebase por CDN. O Firestore contém `users`, `products`, `schedules` e `appointments`; Authentication protege o painel.

Não substitua Firebase sem uma decisão explícita. A disponibilidade é controlada por `schedules.is_available`. A reserva deve continuar atômica: criar `appointments/{scheduleId}` e mudar o horário para indisponível na mesma transação. O cliente público pode criar somente uma reserva validada; leituras de dados pessoais devem continuar restritas a barbeiros/admins.

O lembrete atual é assistido: links Google Calendar para cliente/barbeiro e WhatsApp para confirmação/aviso. Isso não equivale a uma notificação automática. Se for solicitado lembrete automático, implemente backend confiável, controle de duplicidade, consentimento, falhas, cancelamento e proteção de dados; não finja que um link é um envio automático.

Antes de adicionar estruturas, verifique os arquivos reais e este documento. Diferencie sempre implementado, planejado, inferido e desconhecido. Não invente endpoints, tabelas ou credenciais.

## 16. Informações que ainda precisam ser descobertas

- Qual conta/projeto Firebase receberá a publicação final.
- Qual canal automático de lembrete será aprovado e quais credenciais/consentimentos serão necessários.
- Quantos minutos antes do atendimento os lembretes devem ocorrer.
- Se existe uma agenda Google do barbeiro que possa receber eventos via integração autorizada.
- Política de cancelamento, reagendamento e privacidade.
- URL ou arquivos do projeto Mevam usados como referência.

## 17. Organização local e referência visual MEVAM

- O dashboard local foi reorganizado para acompanhar o layout desktop do projeto Livraria MEVAM em `A:\Trabalho Vitor\04_devs\Site Mevam`.
- A adaptação está concentrada em `public/styles.css`, sem trocar a estrutura funcional ou o Firebase:
  - sidebar azul fixa no desktop;
  - conteúdo administrativo em fundo claro;
  - cartões brancos com bordas leves;
  - cabeçalho e títulos alinhados à esquerda;
  - grade responsiva preservando a organização mobile existente.
- Em telas pequenas, a sidebar volta a ser barra superior e o conteúdo ocupa toda a largura.
- Foi criado o backup `backup/dashboard-layout-2026-09-13/` contendo cópias de `dashboard.html`, `dashboard.js` e `styles.css`.
- A auditoria não encontrou arquivo inequivocamente descartável. Nenhum arquivo foi excluído para evitar quebrar rotas públicas, o atalho de barbeiro, o modo offline ou o service worker.
- As validações locais realizadas foram `node --check` nos scripts alterados e `git diff --check`.
- Após revisão, os estilos MEVAM foram limitados ao breakpoint desktop (`min-width: 769px`). O CSS mobile original do dashboard não deve ser alterado pela referência visual desktop.
- A estrutura visual desktop permanece inspirada no MEVAM, mas a paleta foi alinhada ao Maneirin Studio: fundo escuro `#111827`, azul marinho `#1e3a8a`, azul de destaque `#2563eb`, azul claro `#60a5fa`, texto claro e superfícies neutras. Essa alteração não se aplica ao layout mobile.
