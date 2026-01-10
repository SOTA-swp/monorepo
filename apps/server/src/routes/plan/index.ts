import { FastifyInstance } from "fastify";
import { planProfileRoutes } from "./profile";
import { planRouteRoutes } from "./route";

export async function planRoutes(server: FastifyInstance) {
  server.register(planProfileRoutes);
  server.register(planRouteRoutes);
}