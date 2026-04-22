# eclick-frontend

Frontend do projeto eclick-saas, construído com Next.js 14 (App Router).

## Tecnologias

- [Next.js 14](https://nextjs.org/) com App Router
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [shadcn/ui](https://ui.shadcn.com/)

## Estrutura de Pastas

```
eclick-frontend/
├── public/               # Arquivos estáticos
├── src/
│   ├── app/              # Rotas (App Router)
│   ├── components/       # Componentes reutilizáveis
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Utilitários e helpers
│   ├── styles/           # Estilos globais
│   └── types/            # Definições de tipos TypeScript
└── ...
```

## Instalação

```bash
npm install
```

## Desenvolvimento

```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

## Build

```bash
npm run build
npm start
```

## Variáveis de Ambiente

Copie `.env.example` para `.env.local` e preencha os valores.

```bash
cp .env.example .env.local
```
