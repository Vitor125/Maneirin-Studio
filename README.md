# Maneirin Studio

Site público e painel interno da barbearia. HTML, CSS e módulos JavaScript nativos, com Firebase Authentication, Firestore e Hosting. Não há servidor próprio nem etapa de build.

As decisões funcionais, o histórico e os limites atuais estão em [CONTEXT.md](CONTEXT.md). Leia esse arquivo antes de alterar o fluxo de reserva.

## Organização

| Local | Responsabilidade |
| --- | --- |
| `public/index.html`, `agenda/`, `produtos/` | Páginas públicas |
| `public/dashboard.html` | Login e abas Agenda, Fotos, Produtos e Barbeiros |
| `public/script.js` | Busca e exibição dos dados públicos |
| `public/dashboard.js` | Sessão, formulários e ações do painel |
| `public/js/firebase.js` | Única inicialização do Firebase |
| `public/js/utils.js` | Escape, URLs, datas e validações sem dependência de página |
| `public/js/media.js` | Validação e carregamento de imagens |
| `public/js/calendar.js` | Link preenchido do Google Calendar |
| `public/js/ui.js` | Menu, animações, instalação e registro do service worker |
| `public/styles.css` | Estilos organizados por seção e tamanho de tela |
| `public/sw.js` | Cache dos arquivos estáticos e fallback offline |
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
- As listas privadas verificam se a sessão e o papel continuam os mesmos antes de mostrar uma resposta. Preserve essa proteção em novas consultas assíncronas.
- Adicionar um módulo estático exige atualizar `APP_SHELL` e a versão do cache em `public/sw.js`.
- O SDK Firebase tem versão fixa nos imports. Se for atualizado, mantenha todos os imports na mesma versão e execute as verificações.
- A configuração web do Firebase identifica o projeto; não é uma credencial administrativa. Nunca coloque chaves de serviço, tokens de sessão ou senhas em `public/` ou no Git.

## Publicar

Após os testes e a conferência visual:

```sh
firebase deploy --only hosting,firestore:rules --project site-maneirin-studio --non-interactive
```

Confira as páginas públicas e o painel, depois registre as alterações no GitHub e em `CONTEXT.md`. As regras novas validam futuras gravações; não migram nem apagam documentos antigos.

O Google Calendar ainda exige clicar em **Salvar**. Imagens são armazenadas no Firestore com limite de 600 KB por arquivo. Estes e outros limites estão detalhados no contexto.
