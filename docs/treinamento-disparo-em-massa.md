# Centro de Treinamento — guia "Como usar o Disparo em Massa"

Este documento explica onde o guia vive no código, como atualizá-lo e traz o **prompt** para gerar/revisar o
conteúdo (adaptado do prompt usado no guia do Portal de Pesagem).

## Onde fica

| O quê | Onde |
|---|---|
| Menu "Centro de Treinamento" (botão direto na sidebar, sem submenu) | `src/lib/navigation.ts` (grupo `treinamento` com `direto: true`, visível para todos os perfis) |
| Página de guias (botão **Abrir passo a passo**) | `src/routes/_authenticated/treinamento.index.tsx` → `/treinamento` |
| Página do guia | `src/routes/_authenticated/treinamento.disparo-em-massa.tsx` → `/treinamento/disparo-em-massa` |
| Conteúdo (passos, alertas, exemplos, problemas) | `src/lib/treinamento/disparo-em-massa.ts` |
| Tipos do conteúdo | `src/lib/treinamento/tipos.ts` |
| Tela do guia (sumário, caixas de alerta, zoom no print) | `src/components/treinamento/guia-passo-a-passo.tsx` |
| Versão HTML autocontida (imagens em base64) | `src/lib/treinamento/guia-html.ts` — botão **Baixar versão HTML** na página do guia |
| Prints | `public/guias/disparo-em-massa/NN-nome.png` |

A tela e o HTML baixado saem do mesmo objeto (`guiaDisparoEmMassa`), então nunca divergem. Se um print ainda não
existe, a tela mostra um espaço reservado e o HTML baixado faz o mesmo.

## Como atualizar

1. **Texto**: edite `src/lib/treinamento/disparo-em-massa.ts`. Os rótulos de botões e limites vêm do código das
   telas; se uma tela mudar, ajuste o passo correspondente.
2. **Prints**: capture no portal atual (sem marca de outra empresa) e substitua o arquivo em `public/guias/disparo-em-massa/` mantendo o nome. Use 1440×900, sem
   dados pessoais reais (veja as regras abaixo).
3. **Novo guia**: crie `src/lib/treinamento/<nome>.ts` (tipo `Guia`), uma rota `treinamento.<nome>.tsx` e um
   cartão em `treinamento.index.tsx`.

### Regras para os prints (LGPD)

- Nunca publicar nome, CPF/CNPJ, e-mail ou telefone de comprador real. Use a planilha fictícia (João da Silva,
  Maria Oliveira, Carlos Souza, Fernanda Lima — e-mails `@exemplo.com.br`).
- Telas com dados reais (Dashboard, Histórico, Relatórios, Usuários) saem com e-mails/CPF/telefones mascarados e
  nomes desfocados; o nome do usuário logado é trocado por "Nome do Usuário".
- Nunca clicar em **Disparar agora** ao capturar: o Novo Disparo para na tela de Revisão e o rascunho é descartado.

## Prompt (versão para o Disparo em Massa)

> Base: prompt do guia do Portal de Pesagem. Mudanças: contexto, estrutura, cor (o portal usa o azul ameno da logo WSA
> com abóbora clarinho de destaque — os mesmos tokens de `src/styles.css`), e prints reais do próprio
> portal.

```text
Crie um guia passo a passo chamado "Como usar o Disparo em Massa – WSA Sistemas",
destinado aos analistas, à equipe administrativa e aos administradores do portal.
Linguagem simples, direta, em português, para quem não é da área de TI. Não use
termos técnicos como "envelope", "API", "JWT" ou "polling": para o usuário, o
sistema envia documentos para assinatura em massa.

CONTEXTO DO SISTEMA
- Portal web da WSA Sistemas (login com e-mail corporativo e senha). Envia
  documentos para assinatura (DocuSign) a vários compradores de empreendimentos de
  uma só vez, por WhatsApp e/ou e-mail, e acompanha cada assinatura.
- Primeiro acesso: o administrador entrega uma senha inicial; o portal obriga a
  troca (12 a 128 caracteres, ao menos 3 entre minúscula/maiúscula/número/símbolo,
  sem "senha", "calper" ou sequências). Não existe "esqueci minha senha": um Super
  Admin gera uma nova. 5 senhas erradas em 15 min bloqueiam a conta. A verificação
  em duas etapas (aplicativo autenticador) é opcional e exigida do Super Admin em
  operações sensíveis.
- Perfis: Analista (Dashboard, Novo Disparo, Histórico, Relatórios), Admin (+
  consulta às Integrações, Gateway de APIs, Logs Gerais, Privacidade) e Super Admin
  (+ credenciais, Usuários, Perfis). O Analista só vê as campanhas que criou.
- Novo Disparo em 6 etapas, nesta ordem: 1 Origem (TOTVS RM por empreendimento ou
  Planilha Excel .xlsx/.csv; nome da campanha obrigatório), 2 Compradores (só linhas
  com nome, telefone com DDD e e-mail válidos podem ser marcadas), 3 Modelo (modelos
  do DocuSign + Canais de envio: WhatsApp, E-mail ou Ambos), 4 Verificação (aponta
  bloco/unidade ausentes, telefone/e-mail inválidos, CPF inválido; "Baixar erros"),
  5 Assinatura (2º comprador: não há / assina / recebe em cópia (CC); lembrete,
  expiração e idioma), 6 Revisão (mensagem com {{nome}}, {{empreendimento}},
  {{unidade}}, resumo e "Disparar agora" com barra de progresso).
- Planilha: colunas comprador_1, email, telefone, unidade, bloco (obrigatórias) e
  comprador_2, email_2, telefone_2 (2º comprador, só pela planilha). Até 5 MB e
  5.000 linhas. Coluna com nome errado fica vazia sem aviso.
- Limites: 2.000 destinatários por campanha, 5.000 envios por dia por usuário.
- Cópia (CC) só vale no canal E-mail. O e-mail do comprador é obrigatório mesmo no
  canal só WhatsApp.
- Acompanhamento: Dashboard (indicadores), Histórico (lista), Relatórios (filtros e
  detalhe com status Assinado / Pendente assinatura / Cancelado, "Reenviar",
  "Exportar CSV" mascarado; o CSV completo é só para Admin e Super Admin).
- LGPD: compradores na lista de descadastro (Administração › Privacidade) são
  pulados automaticamente; contatos aparecem mascarados nos relatórios.

ESTRUTURA DO GUIA
1. Acessar o portal e fazer o primeiro login (troca de senha)
2. Conhecer o portal e o seu perfil
3. Iniciar um novo disparo: origem dos compradores
4. Conferir e selecionar os compradores
5. Escolher o modelo do documento e o canal de envio
6. Verificação final dos destinatários
7. Configurar a assinatura (2º comprador, prazos e idioma)
8. Revisar e disparar
9. Acompanhar as assinaturas e exportar
10. Proteger a conta com verificação em duas etapas
11. Para administradores: usuários, integrações e privacidade (LGPD)
12. Problemas comuns (senha, bloqueio, RM/DocuSign fora, planilha inválida, disparo
    interrompido) e quem acionar na TI

FORMATO
- Cada passo com: título curto, onde fica a tela, quem pode usar, o que fazer (frases
  numeradas) e os prints reais da tela, na ordem do fluxo.
- Destaque em caixa de alerta os pontos críticos (depois de "Disparar agora" não há
  como desfazer; não fechar a janela durante o disparo; corrigir linhas em erro na
  origem antes de continuar; não compartilhar CSV/prints com dados de compradores).
- Use um exemplo prático com dados fictícios (planilha de 4 compradores: um com
  telefone incompleto, um sem bloco) para mostrar o que cada etapa aprova ou bloqueia.
- Identidade visual WSA Sistemas: azul ameno da logo como cor principal, abóbora clarinho de destaque, neutros frios.
- Ao final, gere também uma versão HTML autocontida (imagens em base64) para salvar
  nos favoritos ou numa pasta de rede.

PRINTS
- Acesse o portal, percorra o fluxo com uma planilha FICTÍCIA e capture 1440×900.
- Mascare e-mails, CPF e telefones reais; desfoque nomes; troque o nome do usuário
  logado por "Nome do Usuário". Nunca clique em "Disparar agora" para capturar.
```
