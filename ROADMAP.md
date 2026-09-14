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
  (`document-loader.service.ts`, `vectorstore.service.ts`), com índice
  vetorial persistente em **Chroma** (sobrevive a um restart do servidor)
- **Múltiplas conversas (conversationId)** — `conversation.store.ts` usa um
  `Map<conversationId, Message[]>`; todos os endpoints de chat aceitam
  `?conversationId=...` na URL, caindo numa conversa `"default"` se omitido
- **Function calling / Tools** — `general-assistant` decide sozinho,
  via tool-calling, se pesquisa documentos, pesquisa a web, ou delega a
  pergunta a outro agente (`veterinary-assistant`) como sub-agente
  (`tool-calling-graph.ts`, `buildToolCallingGraph`)
- **Subgrafos do LangGraph** — `router-assistant` compõe grafos
  compilados diretamente como nós de outro grafo, com estado partilhado,
  em vez de usar tools — roteamento decidido em código
  (`addConditionalEdges`), não pelo modelo
- **Autenticação (JWT, login/senha)** — `POST /api/auth/login` com
  usuário/senha (hash `scrypt`), token JWT validado por um middleware
  (`auth.middleware.ts`) que protege todas as rotas `/api/*`. Usuários são
  criados via script (`npm run create-user`), sem registro público
- **Isolamento por usuário** — conversas (`conversation.store.ts`) e RAG
  (`vectorstore.service.ts`) agora são segregados por `userId`: um
  documento que o usuário A subiu não aparece nas buscas nem na listagem
  do usuário B, e o histórico de chat não se mistura mesmo quando os dois
  usam o mesmo `conversationId`
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

## 🔜 Próximos passos — avançado

- [ ] **Visão (imagens)** — trocar/baixar um modelo multimodal (ex:
      `llava`) e permitir enviar imagens junto da pergunta.
- [ ] **Observabilidade (LangSmith)** — ferramenta pra "ver por dentro"
      o que a IA fez em cada chamada (quais chunks o RAG buscou, quanto
      tempo levou cada etapa) — útil quando o comportamento fica difícil
      de debugar só com `console.log`.

## 🚨 Diagnóstico do RAG — lacunas identificadas

Levantamento feito em análise dedicada ao pipeline de RAG do projeto,
numerado por ordem de impacto (não de esforço — veja as seções acima pra
isso). Mantido junto e em destaque porque foi o ponto de partida de boa
parte do que já foi feito e do que ainda falta.

1. [x] **Isolamento por usuário/conversa — o gap mais sério.**
   `searchRelevantChunks` buscava em toda a coleção do Chroma, sem
   filtrar por usuário ou conversa: o documento que o usuário A subia
   aparecia nas respostas pro usuário B. **Feito** — chunks gravam
   `userId` no metadata (`addDocumentChunks`) e a busca/listagem filtram
   por `{ userId }`; conversas também são segregadas por usuário em
   `conversation.store.ts`.
2. [x] **Sem reescrita de pergunta (query rewriting).**
   `searchRelevantChunks` embedava só a última mensagem do usuário,
   isolada. Numa conversa como "quem é o gerente do projeto X?" seguida
   de "e qual o salário dele?", a segunda pergunta sozinha não carregava
   contexto sobre quem é "ele" e a busca vetorial provavelmente falhava.
   **Feito** — `rewriteQuery` (`ollama.service.ts`) usa o histórico da
   conversa pra reescrever a pergunta de forma autossuficiente antes de
   buscar, usado em `document-assistant.agent.ts` e
   `router-assistant.agent.ts`. Também **feito** como complemento:
   **HyDE** — `generateHypotheticalAnswer` (`ollama.service.ts`) gera uma
   resposta hipotética a partir da pergunta (já reescrita) e é o texto
   dela, não da pergunta, que é embedado em `searchRelevantChunks`
   (`vectorstore.service.ts`) — ataca o problema de vocabulário/formato
   diferente entre pergunta e documento, complementar ao rewriting (que
   resolve o contexto conversacional).
3. [ ] **Sem reranking.**
   Filtramos por score (≥0.5) e balanceamos por fonte, mas não há um
   segundo passe (cross-encoder) reordenando os candidatos por
   relevância real à pergunta. Busca vetorial pura erra bastante em
   nuance — reranking é o refinamento mais citado como "próximo passo
   depois do RAG básico".
4. [ ] **Sem busca híbrida (keyword + vetorial).**
   Embeddings são ótimos pra "significado", ruins pra correspondência
   exata (números de contrato, IDs, nomes próprios exatos). Um RAG mais
   robusto combina vetorial + BM25/keyword search.
5. [ ] **Chunking ingênuo.**
   `RecursiveCharacterTextSplitter` corta por caracteres, sem noção de
   estrutura (títulos, parágrafos, tabelas). Um PDF com tabela pode ser
   cortado no meio da tabela, quebrando o sentido.
6. [ ] **Sem gestão de documentos.**
   `document.controller.ts` só tem `POST` (indexar) e `GET` (listar
   fontes). Não existe deletar um documento específico do índice
   (reupload duplicado = chunks duplicados pra sempre) nem reindexar
   quando o arquivo muda.
7. [ ] **Só 3 formatos de arquivo.**
   `loadRawDocument` só aceita PDF, DOC e DOCX
   (`document-loader.service.ts:31-45`) — sem `.txt`, `.md`, `.csv`,
   páginas web.
8. [ ] **Sem verificação de alucinação/citação.**
   O "bilhete" em `buildContextFromChunks` pede pro modelo citar a fonte
   e o trecho verbatim, mas isso é só instrução de prompt — nada valida
   depois se o texto citado realmente está no chunk. O modelo pode
   inventar uma citação plausível.
9. [ ] **Sem avaliação (eval).**
   Não há um dataset de perguntas/respostas esperadas pra medir se o
   retrieval está bom. Hoje a única forma de saber se o RAG funciona é
   testar manualmente.
10. [ ] **Cobertura de teste.**
    `vectorstore.service.test.ts` testa só `buildContextFromChunks` — a
    lógica mais delicada (filtro de score, balanceamento por fonte em
    `searchRelevantChunks`) não tem teste nenhum, porque depende do
    Chroma real (não tem abstração/mock pra isolar essa lógica).

## Notas

- Prioridade sugerida: dentro do diagnóstico do RAG acima, **avaliação
  (eval)** antes de qualquer refinamento (reranking, chunking, query
  rewriting) — sem uma forma objetiva de medir, cada ajuste de
  prompt/estratégia vira tentativa e erro manual. Fora do RAG, **Zod →
  PromptTemplate** continuam sendo os itens mais baratos de aprender e
  não exigem infraestrutura nova.
- Este arquivo é só um guia — atualize conforme os itens forem sendo
  feitos ou a prioridade mudar.
