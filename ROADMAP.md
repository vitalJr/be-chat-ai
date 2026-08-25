# Roadmap de IA — ollama-chat-api

Lista do que já foi implementado e do que pode vir a seguir, organizada por
prioridade. Cada item tem o **porquê** — o objetivo é sempre entender o
conceito por trás, não só "ter a feature".

## ✅ Já implementado

- Chat simples com o Ollama (`/api/chat`)
- Streaming de resposta (`/api/chat/stream`)
- Histórico de conversa em memória, com resumo automático quando fica
  grande (`conversation.store.ts`)
- Configurações de geração (`temperature`, `num_predict`, `top_p`, etc.)
- Upload de documentos PDF/DOC/DOCX (`/api/documents`)
- **RAG** (Retrieval-Augmented Generation): extração de texto, chunking,
  embeddings (`nomic-embed-text`) e busca semântica com LangChain
  (`document-loader.service.ts`, `vectorstore.service.ts`)
- **Múltiplas conversas (conversationId)** — `conversation.store.ts` usa um
  `Map<conversationId, Message[]>`; todos os endpoints de chat aceitam
  `?conversationId=...` na URL, caindo numa conversa `"default"` se omitido
- Frontend em Next.js pra testar tudo isso visualmente

## 🔜 Próximos passos — fácil

- [ ] **Saída estruturada e tipada (Zod)** — em vez de a IA responder só
      texto solto, definir um schema (`z.object({...})`) e forçar a
      resposta em JSON validado. É o que dá tipagem de verdade na
      fronteira entre TypeScript e a IA, que hoje é sempre `string`.
- [ ] **Modelo por requisição** — deixar o `/api/chat` receber
      `{ "message": "...", "model": "mistral" }` em vez do modelo fixo no
      `.env`. Baixo esforço, ajuda a comparar modelos na prática.
- [ ] **Logs das conversas em arquivo** — salvar cada pergunta/resposta
      num arquivo simples, pra debug e histórico de uso.

## 🔜 Próximos passos — intermediário

- [ ] **PromptTemplate do LangChain** — hoje o `SYSTEM_PROMPT` é uma
      string concatenada na mão em `ollama.service.ts`. O LangChain tem
      `PromptTemplate`/`ChatPromptTemplate` pra templates reutilizáveis
      com variáveis — fica mais organizado conforme os prompts crescem.
- [ ] **Processamento de documentos em segundo plano** — hoje o upload
      (`document.controller.ts`) só responde depois de extrair o texto E
      gerar os embeddings, tudo dentro do mesmo request HTTP. Pra
      documentos grandes isso pode demorar. Alternativa: responder
      "recebido, processando..." na hora e deixar o cliente consultar
      `GET /api/documents` pra ver quando `indexed` vira `true`.
- [ ] **Vector store persistente** — o índice do RAG
      (`vectorstore.service.ts`) é `MemoryVectorStore`: some ao reiniciar
      o servidor. Trocar por algo como **Chroma** (roda local e grátis,
      parecido com o Ollama) resolve isso.
- [ ] **Autenticação simples** — proteger a API com uma chave
      (header `x-api-key`), já que hoje qualquer um na rede local pode
      usar.

## 🔜 Próximos passos — avançado

- [ ] **Function calling / Tools (Agentes)** — deixar a IA **decidir
      chamar uma função sua** durante a conversa (ex: consultar o clima,
      rodar uma query no banco) em vez de só gerar texto. É o próximo
      passo natural depois do exemplo de SQL Agent que já vimos
      (`SqlToolkit` + `createSqlAgent` do LangChain).
- [ ] **Visão (imagens)** — trocar/baixar um modelo multimodal (ex:
      `llava`) e permitir enviar imagens junto da pergunta.
- [ ] **Observabilidade (LangSmith)** — ferramenta pra "ver por dentro"
      o que a IA fez em cada chamada (quais chunks o RAG buscou, quanto
      tempo levou cada etapa) — útil quando o comportamento fica difícil
      de debugar só com `console.log`.

## Notas

- Prioridade sugerida: **Zod → PromptTemplate → vector store
  persistente → Tools/Agentes**. Os dois primeiros são baratos de
  aprender e não exigem infraestrutura nova; os últimos são o salto de
  "chat que responde" pra "assistente que age".
- Este arquivo é só um guia — atualize conforme os itens forem sendo
  feitos ou a prioridade mudar.
