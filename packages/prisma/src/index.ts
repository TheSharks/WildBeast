import { PrismaClient } from "@prisma/client";

const client = new PrismaClient();

export * from "@prisma/client";
export default client;
