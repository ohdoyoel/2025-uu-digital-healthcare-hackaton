"use client";
import React, { useEffect, useState } from "react";
import { Sidebar, SidebarBody, SidebarLink } from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  UserCog,
  Settings,
  LogOut,
  UserCircle,
} from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import Image from "next/image";
import { cn } from "@/lib/utils";

export default function Page() {
  //   const links = [
  //     {
  //       label: "대시보드",
  //       href: "#",
  //       icon: (
  //         <LayoutDashboard className="text-neutral-700 h-6 w-6 flex-shrink-0" />
  //       ),
  //     },
  //     // {
  //     //   label: "Profile",
  //     //   href: "#",
  //     //   icon: <UserCog className="text-neutral-700 h-5 w-5 flex-shrink-0" />,
  //     // },
  //     {
  //       label: "설정",
  //       href: "#",
  //       icon: <Settings className="text-neutral-700 h-6 w-6 flex-shrink-0" />,
  //     },
  //     // {
  //     //   label: "로그아웃",
  //     //   href: "#",
  //     //   icon: <LogOut className="text-neutral-700 h-6 w-6 flex-shrink-0" />,
  //     // },
  //   ];
  //   const [open, setOpen] = useState(false);
  //   return (
  //     <div
  //       className={cn(
  //         "rounded-md flex flex-col md:flex-row bg-gray-100 w-full flex-1 mx-auto border border-neutral-200 overflow-hidden",
  //         "h-screen"
  //       )}
  //     >
  //       <Sidebar open={open} setOpen={setOpen}>
  //         <SidebarBody className="justify-between gap-10">
  //           <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
  //             {open ? <Logo /> : <LogoIcon />}
  //             <div className="mt-8 flex flex-col gap-2">
  //               {links.map((link, idx) => (
  //                 <SidebarLink key={idx} link={link} />
  //               ))}
  //             </div>
  //           </div>
  //           <div>
  //             <SidebarLink
  //               link={{
  //                 label: "오도열",
  //                 href: "#",
  //                 icon: <AvatarWithFallback src="#" alt="Avatar" />,
  //               }}
  //             />
  //           </div>
  //         </SidebarBody>
  //       </Sidebar>
  //       <Dashboard />
  //     </div>
  //   );
  // }

  // export const Logo = () => {
  //   return (
  //     <Link
  //       href="#"
  //       className="font-normal flex space-x-2 items-center text-2xl text-black py-1 relative z-20"
  //     >
  //       <div className="h-8 w-6 bg-green-500 rounded-br-lg rounded-tr-sm rounded-tl-lg rounded-bl-sm flex-shrink-0" />
  //       <motion.span
  //         initial={{ opacity: 0 }}
  //         animate={{ opacity: 1 }}
  //         className="font-medium text-black whitespace-pre"
  //       >
  //         토닥토닥
  //       </motion.span>
  //     </Link>
  //   );
  // };

  // export const LogoIcon = () => {
  //   return (
  //     <Link
  //       href="#"
  //       className="font-normal flex space-x-2 items-center text-black py-1 relative z-20"
  //     >
  //       <div className="h-8 w-6 bg-green-500 rounded-br-lg rounded-tr-sm rounded-tl-lg rounded-bl-sm flex-shrink-0" />
  //     </Link>
  //   );
  // };

  // const AvatarWithFallback = ({ src, alt }: { src: string; alt: string }) => {
  //   const [isImageReady, setIsImageReady] = useState(false);

  //   useEffect(() => {
  //     let isMounted = true;
  //     if (!src || !/^https?:\/\//.test(src)) {
  //       setIsImageReady(false);
  //       return () => {
  //         isMounted = false;
  //       };
  //     }

  //     const verifyImage = async () => {
  //       try {
  //         const response = await fetch(src, { method: "HEAD" });
  //         if (isMounted) {
  //           setIsImageReady(response.ok);
  //         }
  //       } catch (error) {
  //         if (isMounted) {
  //           setIsImageReady(false);
  //         }
  //       }
  //     };

  //     verifyImage();

  //     return () => {
  //       isMounted = false;
  //     };
  //   }, [src]);

  //   if (!isImageReady) {
  //     return <UserCircle className="h-7 w-7 flex-shrink-0 text-neutral-500" />;
  //   }

  //   return (
  //     <Image
  //       src={src}
  //       className="h-7 w-7 flex-shrink-0 rounded-full"
  //       width={50}
  //       height={50}
  //       alt={alt}
  //     />
  //   );
  // };

  // // Dummy dashboard component with content
  // const Dashboard = () => {
  //   return (
  //     <div className="flex flex-1">
  //       <div className="p-2 md:p-10 rounded-tl-2xl border border-neutral-200 bg-white flex flex-col gap-2 flex-1 w-full h-full">
  //         <div className="flex gap-2">
  //           {[...new Array(4)].map((i) => (
  //             <div
  //               key={"first-array" + i}
  //               className="h-20 w-full rounded-lg  bg-gray-100 animate-pulse"
  //             ></div>
  //           ))}
  //         </div>
  //         <div className="flex gap-2 flex-1">
  //           {[...new Array(2)].map((i) => (
  //             <div
  //               key={"second-array" + i}
  //               className="h-full w-full rounded-lg  bg-gray-100 animate-pulse"
  //             ></div>
  //           ))}
  //         </div>
  //       </div>
  //     </div>
  // );
  return <div>Hello</div>;
}
