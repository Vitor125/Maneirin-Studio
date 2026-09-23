# Maneirin Studio

Dois aplicativos web instaláveis: **Maneirin Cliente** em `/cliente/` e **Maneirin Barbeiro** em `/barbeiro/`. HTML, CSS e módulos JavaScript nativos, com Firebase Authentication, Firestore e Hosting. Não há servidor próprio nem etapa de build.

As decisões funcionais, o histórico e os limites atuais estão em [CONTEXT.md](CONTEXT.md). Leia esse arquivo antes de alterar o fluxo de reserva.

As configurações sem suporte a comentários estão explicadas em [CONFIGURACAO.md](CONFIGURACAO.md). O código próprio tem comentários de responsabilidade, funções e decisões dos fluxos.

## Organização

| Local | Responsabilidade |
| --- | --- |
| `public/cliente/index.html`, `cliente/agenda/`, `cliente/produtos/` | Páginas públicas |
| `public/barbeiro/index.html` | Login e abas Agenda, Fotos, Produtos e Barbeiros |
| `public/script.js` | Busca e exibição dos dados públicos |
| `public/dashboard.js` | Sessão, formulários e ações do painel |
| `public/js/firebase.js` | Única inicialização do Firebase |
| `public/js/utils.js` | Escape, URLs, datas e validações sem dependência de página |
| `public/js/media.js` | Validação e carregamento de imagens |
| `public/js/calendar.js` | Link preenchido do Google Calendar |
| `public/js/ui.js` | Menu, animações, instalação e registro do service worker |
| `public/js/carousel.js` | Faixas contínuas, arraste, teclado e pausa acessível |
| `public/js/permissions.js` | Contrato das permissões Agenda, Fotos e Produtos |
| `public/js/admin.js` | Cartões da equipe e gravação transacional dos acessos |
| `public/styles.css` | Estilos organizados por seção e tamanho de tela |
| `public/cliente/sw.js`, `public/barbeiro/sw.js` | Escopo, lista de arquivos e versão do cache de cada aplicativo |
| `public/js/sw-runtime.js` | Motor de cache comum com isolamento por aplicativo |
| `public/sw.js` | Migração do worker antigo da raiz |
| `firestore.rules` | Permissões e validação dos documentos no banco |
| `tests/` | Regressões locais e simulação das regras |

O painel não importa a página pública. Ambos reutilizam os módulos de `public/js/`, que não iniciam telas por conta própria. As páginas chamam `initCommonUI()` na inicialização.

## Executar e verificar

Use Node.js 22 ou superior. Os testes locais usam apenas a biblioteca padrão; não é necessário instalar dependências npm.

```sh
npm run check
npm test
```

Com Firebase CLI instalado e autenticado no projeto:

```sh
npm run test:rules
firebase serve --only hosting --project site-maneirin-studio
```

**A prévia de Hosting acima usa o Firebase real.** Não cadastre usuários, fotos ou horários de teste nela. Os testes automatizados usam dados fictícios; o simulador de regras não grava documentos de produção. Os artefatos de revisão em `.qa/` são locais e não fazem parte do aplicativo.

## Manutenção

- Escape todo dado inserido em templates HTML, inclusive identificadores. Converta documentos com `documentData()` para impedir que um campo `id` substitua o ID real.
- Links passam por `safeExternalUrl()` e imagens por `safeImageUrl()`. Eventos são ligados por `addEventListener`, sem código inline no HTML.
- Valide os formulários e também `firestore.rules`; a interface nunca substitui a autorização do banco. Novos campos exigem revisão das regras e dos testes.
- As listas privadas verificam se a sessão, o papel e as permissões continuam os mesmos antes de mostrar uma resposta. Preserve essa proteção em novas consultas assíncronas.
- Adicionar um módulo estático exige atualizar `shell` e `version` no worker de cada aplicativo que o utiliza. Alterar o motor comum exige incrementar as duas versões.
- O SDK Firebase tem versão fixa nos imports. Se for atualizado, mantenha todos os imports na mesma versão e execute as verificações.
- A configuração web do Firebase identifica o projeto; não é uma credencial administrativa. Nunca coloque chaves de serviço, tokens de sessão ou senhas em `public/` ou no Git.

## Publicar

Após os testes e a conferência visual:

```sh
firebase deploy --only hosting,firestore:rules --project site-maneirin-studio --non-interactive
```

Confira as páginas públicas e o painel, depois registre as alterações no GitHub e em `CONTEXT.md`. As regras novas validam futuras gravações; não migram nem apagam documentos antigos.

O Google Calendar ainda exige clicar em **Salvar**. Imagens são armazenadas no Firestore com limite de 600 KB por arquivo. Estes e outros limites estão detalhados no contexto.

## Aplicativos independentes

Cliente e Barbeiro usam manifests com identidades distintas e escopos sem sobreposição. Cada um tem nome, ícones, instalação, entrada, cache e página offline próprios. Abra o endereço correspondente para instalar cada aplicativo. O painel exige login; o cliente consulta apenas os dados públicos. Links públicos no painel abrem fora dele.

A raiz e os favoritos antigos de agenda/produtos/painel redirecionam aos novos endereços. O manifest antigo mantém a identidade do Cliente para permitir atualização de instalações existentes; alguns dispositivos podem exigir reinstalação para atualizar nome/ícone. Não foram instalados ou removidos aplicativos no dispositivo do proprietário durante os testes.

Os dois usam a mesma origem e o mesmo projeto Firebase: regras, dados e módulos comuns continuam compartilhados. A separação de PWA não representa isolamento de origem, credenciais ou armazenamento do navegador. As regras Firestore continuam sendo a fronteira de autorização.
