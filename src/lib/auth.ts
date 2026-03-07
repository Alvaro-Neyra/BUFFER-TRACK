import NextAuth, { type DefaultSession } from "next-auth";
import authConfig from "./auth.config";

declare module "next-auth" {
    interface Session {
        user: {
            id: string;
            role: string;
            projects?: { projectId: string, status: string }[];
            specialtyId?: string;
        } & DefaultSession["user"];
    }

    interface User {
        role?: string;
        projects?: { projectId: string, status: string }[];
        specialtyId?: string;
    }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
    ...authConfig,
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
                token.role = user.role;
                token.projects = user.projects;
                token.specialtyId = user.specialtyId;
            }
            return token;
        },
        async session({ session, token }) {
            if (token && session.user) {
                session.user.id = token.id as string;
                session.user.role = token.role as string;
                session.user.projects = token.projects as { projectId: string, status: string }[] | undefined;
                session.user.specialtyId = token.specialtyId as string | undefined;
            }
            return session;
        }
    },
    session: { strategy: "jwt" },
    pages: {
        signIn: "/login",
    }
});
