import { redirect } from "next/navigation";
import { getCurrentUser } from "../server/auth";
import Dashboard from "./dashboard-client";
export const dynamic="force-dynamic";
export default async function Home(){const user=await getCurrentUser();if(!user)redirect("/login");return <Dashboard initialUser={user}/>;}
