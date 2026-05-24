# Separação e Conferência — Guia do Operador (e-Click CD)

App de bipagem do centro de distribuição. Funciona no **celular** (Android),
abre em **tela cheia** e dá pra **instalar como aplicativo**.

> Endereço: **eclick.app.br/fulfillment** — faça login com seu usuário e-Click.
> No celular, toque em "Adicionar à tela inicial" pra virar app.

---

## O que este app resolve

Acabar com erro de envio (SKU/cor/modelo trocados). Todo pedido passa por
**duas conferências**: quem **separa** bipa cada item, e quem **expede** bipa o
pedido e confere antes de fechar a caixa. **Tudo fica registrado** (quem fez, o
que bipou, quando).

---

## Tela inicial

Mostra o resumo do dia:

- **Fila de separação** — pedidos esperando pra separar
- **Fila de conferência** — pedidos separados, esperando pra expedir
- **Erros bipados (24h)** — quantas vezes alguém bipou item errado
- **Avarias hoje** — produtos avariados registrados

E dois botões grandes: **Separar pedidos** e **Conferir e expedir**.

> Se você trabalha em mais de um CD, escolha o seu no seletor do topo.

---

## 1) Separar pedidos (picking)

1. Toque em **Separar pedidos**. Aparece a lista de pedidos da fila.
2. Toque no pedido que vai separar. O app mostra **um item por vez**.
3. Para cada item, ele mostra **SKU**, **descrição** e **quantidade** (ex: `0/2`).
4. **Bipe o produto** — pode ser **código de barras (EAN)**, **SKU** ou **QR code**.
   - ✅ **Certo:** apito curto + vibração, o contador sobe (`1/2`, `2/2`).
   - ❌ **Errado:** apito grave + tela vermelha. O item **não passa** e o erro
     fica registrado. Pegue o produto certo e bipe de novo.
5. Quando o item completa a quantidade, o app **pula pro próximo** sozinho.
6. Terminou todos → **"Pedido separado!"**. Ele vai automático pra fila de
   conferência. Toque em **Próximo pedido**.

### Botões do item
- **Avaria** — produto chegou quebrado/danificado. Escolha a gravidade
  (Leve / Grave / Perda total), **tire uma foto** e confirme.
- **Bloquear** — item em falta ou problema que trava a separação. O pedido sai
  da fila e o supervisor é avisado.

---

## 2) Conferir e expedir (packing)

1. Toque em **Conferir e expedir**. Aparece a lista de pedidos prontos.
2. Toque no pedido.
3. **Bipe a etiqueta/QR do pedido** pra liberar a conferência.
   - Se bipar o pedido errado, dá erro (vermelho) — confira a etiqueta.
4. Confira os **itens** na tela contra o que está na caixa.
5. **Foto do pacote:**
   - Se aparecer **"obrigatória"** (azul), você **precisa** tirar a foto antes
     de fechar. Toque em **Tirar foto**, fotografe a caixa/itens e confirme.
   - Se for opcional, dá pra fechar sem foto (mas a foto protege contra
     reclamação de "veio errado/faltando").
6. Toque em **Fechar conferência**.
7. Toque em **Imprimir etiqueta**. A etiqueta abre pra impressão
   (Mercado Livre vem no formato do ML; loja/B2B vem em etiqueta simples).
8. Cole a etiqueta, feche a caixa e despache. **Próximo pedido.**

---

## Bipagem — dicas

- O **leitor Bluetooth** funciona como teclado: é só apontar e apertar o gatilho.
  O app já deixa o campo pronto pra receber a leitura — **não precisa tocar na tela**.
- Aceita **SKU**, **EAN** (código de barras) e **QR code**.
- Cada apito/vibração confirma a leitura **sem precisar olhar a tela**.

---

## Sem internet?

Pode continuar trabalhando. Aparece uma faixa laranja **"Sem conexão"**. As
ações que não dependem de validação (avaria, bloqueio) ficam **na fila** e
**sincronizam sozinhas** quando a internet voltar (faixa azul "Sincronizando…").

> A **bipagem dos itens** e o **fechar conferência** precisam de internet pra
> validar na hora — se cair a conexão no meio, espere voltar pra continuar.

---

## Perguntas rápidas

**Bipei e deu vermelho, e agora?**
Produto errado pra esse item. Pegue o certo e bipe. O erro já ficou registrado —
sem problema, é só corrigir.

**O contador não sobe.**
Você bipou um item que não é desse pedido, ou já completou a quantidade. Confira
o SKU na tela.

**Pede foto e eu não consigo abrir a câmera.**
Toque em **Escolher foto** pra tirar pela câmera do celular. Se persistir, avise
o supervisor (permissão de câmera no navegador).

**Fechei sem querer / preciso voltar.**
Use a seta ◀ no topo pra voltar. Nenhum dado se perde.

---

## Prints

> _(inserir capturas de tela aqui: 1) tela inicial · 2) item em separação ·
> 3) erro de bipagem vermelho · 4) conferência com foto · 5) etiqueta impressa)_
