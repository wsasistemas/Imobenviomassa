# Plano — tela de entrada no padrão imobdocerias e ícones no padrão /apple-hig-designer

Mockup aprovado em 24/10/2026: [`docs/mockups/login-imobdocerias.html`](mockups/login-imobdocerias.html).

**O que foi aprovado**
- **Tela de entrada:** estrutura do login do imobdocerias (`.mpl-*` de `imobdocerias/src/styles.css` e `src/routes/auth.tsx`).
  - À esquerda, uma ilustração em tela cheia com etiqueta, título grande com brilho e a faixa de 3 números.
  - À direita, o kicker, o título grande, a régua, rótulos em maiúsculas, campos de 54 px e o botão de 56 px com seta.
- **Cores:** azul WSA + abóbora, os tokens atuais. **Fonte:** Inter, a atual. **Cantos:** arredondados (raio de 12 px nos campos e botões).
- **Ilustração:** a opção C, um boleto fictício flutuando com moedas e o balão do WhatsApp, feito em HTML/SVG e sem foto.
  - Dados de exemplo: Banco 000, linha digitável inválida, marca "EXEMPLO", "Empresa Exemplo".
- **Sem nicho de mercado:** o sistema serve para cobrança de qualquer segmento. Nenhum texto cita imobiliária, apartamento, condomínio ou aluguel.
- **Ícones:** padrão do `/apple-hig-designer`, com o símbolo Lucide (o substituto do SF Symbols na web).
  - Menu: símbolo branco em um quadradinho colorido sólido.
  - Indicadores: quadradinho tingido.
  - Campos e botões: só o símbolo de linha.
  - Os ícones coloridos do Iconify (fluent-color e flat-color-icons) saem.
- **Canais:** WhatsApp (`simple-icons:whatsapp`) e DocuSign (`cib:docusign`), os dois CC0, com glifo de uma cor no quadradinho da cor da marca. O e-mail usa o símbolo `mail` no azul.

**O que não muda**
- Fluxo de login: entrada pelo servidor (`login` em `auth.functions.ts`), bloqueio por tentativas, "Esqueci minha senha" com link de 30 min e conferência da Central de acessos.
- Continua sem auto-cadastro e sem Turnstile.
- A tela de entrada segue sempre clara, mesmo com o tema escuro ligado.
- Identificadores técnicos `imobenviomassa`.
- Nada no banco: este plano é só front-end, sem migration.

**Regras**
- Checklist binário: feito ou não feito.
- Os componentes `IconeDoMenu` e `IconeIlustrativo` mantêm o nome e as props. Muda só o desenho por dentro, para não mexer nos 39 usos de uma vez.
- Nada de recurso externo em tempo de execução: a CSP (`font-src 'self'`, `connect-src` restrito) continua igual.

---

## Fase 1 — Base dos ícones HIG

**Arquivos:** `src/styles.css`, `src/components/icones/icone-colorido.tsx` (vira `icone-hig.tsx`), `src/components/icones/cores-do-menu.ts` (novo), `src/components/icones/marcas.tsx` (novo).

**Checklist**
- [x] 1.1 Criar em `styles.css` as cores de sistema para o tema claro e para o `.dark`, a partir dos tokens oklch: `--sys-blue`, `--sys-green`, `--sys-orange`, `--sys-red`, `--sys-teal`, `--sys-indigo`, `--sys-pink`, `--sys-purple`, `--sys-yellow`, `--sys-gray`, `--marca-whatsapp`, `--marca-docusign`.
- [x] 1.2 Criar as utilidades `.hig-tile` (sólido, símbolo branco) e `.hig-tint` (fundo com 14% da cor, símbolo na cor). Tamanhos 24, 30 e 60 px, com raio proporcional (6, 7 e 14 px).
- [x] 1.3 Criar `cores-do-menu.ts` com o mapa `id → cor`, copiado do `MENU_HIG` do mockup: Configurações em cinza, envio em verde, histórico em laranja, relatórios em roxo, destrutivo e LGPD em vermelho, ids do rodapé incluídos.
- [x] 1.4 Reescrever `IconeDoMenu`: Lucide do `menu-registry` (`item.icon`) dentro do `.hig-tile` na cor do mapa. O rodapé (`rodape_recolher`, `rodape_expandir`, `rodape_sair`) usa `ChevronLeft`, `ChevronRight` e `LogOut`.
- [x] 1.5 Reescrever `IconeIlustrativo`: Lucide dentro do `.hig-tint`, com prop `cor` opcional (padrão `blue`).
- [x] 1.6 Criar `marcas.tsx` com `IconeWhatsApp` e `IconeDocuSign`: SVG de uma cor embutido no código, com o path das coleções CC0, sem Iconify.
- [x] 1.7 Item ativo do menu: o tile ganha contorno branco de 1,5 px sobre o degradê azul → abóbora, como no mockup HIG do imobatendimento.

## Fase 2 — Ícones nas telas

**Arquivos:** os 11 que usam `IconeDoMenu` e `IconeIlustrativo`.

**Checklist**
- [x] 2.1 `app-shell.tsx`: sidebar com tile de 24 px no menu (3 níveis) e de 30 px no rodapé. Conferir menu recolhido e expandido.
- [x] 2.2 `home.tsx`: banner, cards "Escolha o tipo de disparo" (tile de 30 px), KPIs (tint) e atalhos.
- [x] 2.3 `administracao/perfis.tsx`: matriz de permissões com o tile de cada item.
- [x] 2.4 Régua: `regua/ui.tsx`, `regua/filtros-por-campo.tsx`, `regua-cobranca.novo.tsx`, `regua-cobranca.configuracoes.tsx` e `regua-cobranca.templates.tsx`.
- [x] 2.5 Integrações: `zenvia-painel.tsx` usa `IconeWhatsApp` e `email-painel.tsx` usa o `mail` em tile azul. A aba DocuSign usa `IconeDocuSign`.
- [x] 2.6 Botões de ação continuam só com o símbolo de linha, sem tile. Conferir que nenhum botão ganhou quadradinho.
- [x] 2.7 Tema escuro: os tiles usam as cores `.dark` e o contraste do símbolo branco fica em AA.

## Fase 3 — Tela de entrada nova

**Arquivos:** `src/components/login-layout.tsx`, `src/components/login/boleto-ilustracao.tsx` (novo), `src/styles.css` (bloco `.tela-entrada`), `src/routes/auth.tsx`, `src/routes/redefinir-senha.tsx` e `src/routes/trocar-senha.tsx`.

**Checklist**
- [x] 3.1 Trocar `.tema-entrada`, a paleta do Anglo-Americano aplicada em 19/10/2026, por `.tela-entrada`: fundo coral claro no formulário, painel marinho com grade e brilho. A tela segue sempre clara, mesmo com `.dark` no `<html>`.
- [x] 3.2 `LoginLayout`, painel esquerdo:
  - marca WSA no topo;
  - etiqueta "Disparo de Cobranças e Documentos", com degradê azul → abóbora e símbolo `send`;
  - título com o brilho (`mpl-shine`);
  - faixa de números: "3 canais" com WhatsApp, DocuSign e e-mail, "30·60·90 Faixas da régua" e "100% Envios auditados".
- [x] 3.3 `BoletoIlustracao`:
  - recibo do pagador e ficha de compensação;
  - código de barras e QR Pix gerados com semente fixa;
  - 4 moedas "R$";
  - balão do WhatsApp com `boleto-novembro.pdf`.
  
  Tudo fica com `aria-hidden` e sem texto de nicho.
- [x] 3.4 `LoginCard` e campos no padrão `.mpl-*`:
  - kicker "Acesso corporativo" e título "Entrar" com a régua;
  - rótulos em maiúsculas;
  - campos de 54 px com o símbolo em cinza, que fica azul no foco;
  - "Mostrar"/"Ocultar" a senha com área de toque de 44 px;
  - botão de 56 px com seta e brilho ao passar o mouse.
- [x] 3.5 Avisos: erro com `triangle-alert` vermelho e `role="alert"`, sucesso com `circle-check-big` verde e `role="status"`. Usar tokens (`--destructive`, `--success`), sem cor fixa.
- [x] 3.6 Nota "Não tem acesso? As contas são criadas por um administrador da sua empresa." e rodapé "© {ano} WSA Sistemas".
- [x] 3.7 Aplicar o mesmo layout em `/auth` (Entrar e Esqueci a senha), `/redefinir-senha` e `/trocar-senha`.
- [x] 3.8 Celular (390 px): painel com 250 px de altura, boleto menor e semitransparente, sem o balão, sem a faixa de números.
- [x] 3.9 `prefers-reduced-motion`: desliga o brilho do título, a flutuação do boleto, o giro das moedas e a entrada em cascata.

## Fase 4 — Limpeza do Iconify

**Checklist**
- [x] 4.1 Remover `src/components/icones/icones.data.ts` e `scripts/gerar-icones.mjs`.
- [x] 4.2 Remover do `package.json` o script `icones` e as dependências `@iconify/react`, `@iconify-json/flat-color-icons` e `@iconify-json/fluent-color`, depois rodar `npm install`.
- [x] 4.3 Procurar sobras de `fluent-color`, `flat-color-icons` e `addIcon` em `src/`, inclusive no guia de treinamento (`guia-html.ts` e tutoriais).
- [x] 4.4 Atualizar o cabeçalho de `docs/plano-design-system-e-acessos.md`: a linha "Ícones" passa a apontar para este plano.

## Fase 5 — Verificação

**Checklist**
- [x] 5.1 `npm run build` sem erro, mais a checagem de tipos.
- [x] 5.2 No navegador: `/auth` (entrar, senha errada, esqueci a senha, link enviado), `/redefinir-senha` e `/trocar-senha`, a 1400 px e a 390 px.
- [x] 5.3 No navegador: sidebar (expandida, recolhida, item ativo), Página Inicial, Perfis e permissões, Régua (novo lote, templates, configurações) e Integrações, nos temas claro e escuro.
- [x] 5.4 Console sem erro, sem requisição externa nova e CSP sem violação.
- [x] 5.5 Busca por "imobili" nos textos de tela, para garantir que nenhum texto novo cite nicho.
- [x] 5.6 Commit por fase e deploy pelo push no `main` (Vercel automática).

---

## Ordem e dependências

1. Fase 1 → Fase 2: as telas dependem dos componentes novos.
2. Fase 3 pode correr em paralelo à Fase 2, porque só depende da 1.6 (marcas) e da 1.2 (utilidades).
3. A Fase 4 só depois das Fases 2 e 3: enquanto houver uso, o Iconify fica.
4. Fase 5 por último.

---

## Revisões depois da aprovação (24/10/2026)

1. **Ilustração.** Ela passou a ser uma cena de boleto em tela cheia: fundo grafite, boleto grande inclinado sobre uma base laranja curva, boletos desfocados nas bordas e moedas. A cena foi redesenhada em HTML/SVG a partir da referência do Wagner (`src/components/login/boleto-ilustracao.tsx`). Saíram o balão do WhatsApp e o painel marinho com grade.
2. **Design system da tela de entrada.** Passou a ser o mesmo da entrada do ImobDesk, com o `authShell.css` do `imobdesk` portado como `.mpl-*` em `styles.css`:
   - cantos retos;
   - etiqueta abóbora;
   - título `clamp(44px, 4.6vw, 68px)`;
   - campos de 460×54 px com ícone e olho na senha;
   - "Lembrar meu e-mail" (só o e-mail, no `localStorage`);
   - botão em degradê azul → abóbora;
   - breakpoint de 900 px.
   
   Isso substitui o item 3.4 (cantos de 12 px e "Mostrar/Ocultar" no rótulo).
3. **Item 5.3:** conferido no navegador nos temas claro e escuro: Página Inicial, menu e Integrações › Zenvia.
