import { FastifyInstance } from "fastify";
import { userProfileRoutes } from "./profile";
import { userActivityRoutes } from "./activity";

export async function userRoutes(server: FastifyInstance) {
  server.register(userProfileRoutes);
  server.register(userActivityRoutes);
}