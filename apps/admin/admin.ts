import AdminJS from "adminjs";
import AdminJSPrisma from "@adminjs/prisma";
import express from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

AdminJS.registerAdapter(AdminJSPrisma);

const admin = new AdminJS({
  resources: [
    { resource: { model: prisma.parameter, client: prisma } },
    { resource: { model: prisma.tag, client: prisma } },
    { resource: { model: prisma.parameterTag, client: prisma } },
  ],
});

const app = express();
const router = AdminJSExpress.buildRouter(admin);
app.use(admin.options.rootPath, router);

app.listen(3001, () => {
  console.log("AdminJS at http://localhost:3001/admin");
});