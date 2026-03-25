export const SKILLS_LIST = [
  // Languages
  "JavaScript", "TypeScript", "Python", "Java", "C++", "C", "C#", "Go", "Rust",
  "Kotlin", "Swift", "Ruby", "PHP", "Scala", "R", "Dart", "Elixir", "Haskell",
  // Frontend
  "React", "Next.js", "Vue.js", "Angular", "Svelte", "HTML", "CSS", "Tailwind CSS",
  "SASS/SCSS", "Redux", "Zustand", "Framer Motion",
  // Backend
  "Node.js", "Express.js", "Django", "Flask", "FastAPI", "Spring Boot", "Rails",
  "ASP.NET", "NestJS", "GraphQL", "REST API", "gRPC", "WebSocket",
  // Database
  "SQL", "PostgreSQL", "MySQL", "MongoDB", "Redis", "Elasticsearch",
  "Firebase/Firestore", "DynamoDB", "Prisma", "Supabase",
  // DevOps / Cloud
  "AWS", "Google Cloud", "Azure", "Docker", "Kubernetes", "Terraform",
  "CI/CD", "GitHub Actions", "Jenkins", "Nginx", "Linux",
  // CS Fundamentals
  "Data Structures", "Algorithms", "Dynamic Programming", "Graph Theory",
  "Trees", "Sorting", "Searching", "Recursion", "Greedy Algorithms",
  "Bit Manipulation", "Backtracking", "Hashing", "Linked Lists", "Stacks & Queues",
  // Architecture
  "System Design", "Microservices", "Monolith", "Event-Driven Architecture",
  "Design Patterns", "SOLID Principles", "OOP", "Functional Programming",
  // ML / AI
  "Machine Learning", "Deep Learning", "NLP", "Computer Vision",
  "TensorFlow", "PyTorch", "LLMs", "RAG",
  // Tools
  "Git", "VS Code", "Vim", "Jira", "Figma",
  // Testing
  "Unit Testing", "Integration Testing", "Jest", "Cypress", "Playwright",
  // Other
  "Agile/Scrum", "Technical Writing", "Open Source", "Web Security",
  "Mobile Development", "React Native", "Flutter",
] as const;

export type SkillName = (typeof SKILLS_LIST)[number];
