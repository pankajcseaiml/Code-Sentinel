"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { LoginDialog } from "./LoginDialog";
import { SignupDialog } from "./SignupDialog";
import { UserMenu } from "./UserMenu";

export default function HeroSection() {
  const [loginOpen, setLoginOpen] = useState(false);
  const [signupOpen, setSignupOpen] = useState(false);
  const { isAuthenticated } = useAuth();

  return (
    <div className="relative mx-auto flex w-full flex-col items-center justify-center">
      <Navbar isAuthenticated={isAuthenticated} />
      <div className="px-4 py-10 md:py-20">
        <h1 className="relative z-10 mx-auto max-w-4xl text-center text-2xl font-bold text-slate-700 md:text-4xl lg:text-7xl dark:text-slate-300">
          {"Observe AGENTIC dev flows in real-time"
            .split(" ")
            .map((word, index) => (
              <motion.span
                key={index}
                initial={{ opacity: 0, filter: "blur(4px)", y: 10 }}
                animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
                transition={{
                  duration: 0.3,
                  delay: index * 0.1,
                  ease: "easeInOut",
                }}
                className="mr-2 inline-block"
              >
                {word}
              </motion.span>
            ))}
        </h1>
        <motion.p
          initial={{
            opacity: 0,
          }}
          animate={{
            opacity: 1,
          }}
          transition={{
            duration: 0.3,
            delay: 0.8,
          }}
          className="relative z-10 mx-auto max-w-xl py-4 text-center text-lg font-normal text-neutral-600 dark:text-neutral-400"
        >
          ContexML provides a unified dashboard to observe, audit, and
          orchestrate AGENTIC METHOD development workflows. Trace agent
          decisions, inspect sharded story diffs, and ensure production-ready
          delivery assurance.
        </motion.p>
        <motion.div
          initial={{
            opacity: 0,
          }}
          animate={{
            opacity: 1,
          }}
          transition={{
            duration: 0.3,
            delay: 1,
          }}
          className="relative z-10 mt-8 flex flex-wrap items-center justify-center gap-4"
        >
          {!isAuthenticated && (
            <>
              <button
                onClick={() => setLoginOpen(true)}
                className="w-60 transform rounded-lg bg-black px-6 py-2 font-medium text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
              >
                Login
              </button>
              <button
                onClick={() => setSignupOpen(true)}
                className="w-60 transform rounded-lg border border-gray-300 bg-white px-6 py-2 font-medium text-black transition-all duration-300 hover:-translate-y-0.5 hover:bg-gray-100 dark:border-gray-700 dark:bg-black dark:text-white dark:hover:bg-gray-900"
              >
                Sign Up
              </button>
            </>
          )}
        </motion.div>
        <motion.div
          initial={{
            opacity: 0,
            y: 10,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            duration: 0.3,
            delay: 1.2,
          }}
          className="relative z-10 mx-auto mt-20 max-w-4xl rounded-3xl border border-neutral-200 bg-neutral-100 p-4 shadow-md dark:border-neutral-800 dark:bg-neutral-900"
        >
          <div className="w-full overflow-hidden rounded-xl border border-gray-300 dark:border-gray-700">
            <video
              className="aspect-[16/9] h-auto w-full object-cover"
              autoPlay
              loop
              muted
              playsInline
            >
              <source src="/Dash-board-vid.mp4" type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </div>
        </motion.div>
      </div>

      <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} />
      <SignupDialog open={signupOpen} onOpenChange={setSignupOpen} />
    </div>
  );
}

const Navbar = ({ isAuthenticated }: { isAuthenticated: boolean }) => {
  return (
    <nav className="flex w-full items-center justify-between px-4 py-4">
      <div className="flex items-center gap-2">
        <div className="size-7 rounded-full bg-gradient-to-br from-violet-500 to-pink-500" />
        <h1 className="text-base font-bold md:text-2xl">ContexML</h1>
      </div>
      <div className="flex items-center gap-4">
        <a
          href="https://github.com/Cautious-Sea"
          target="_blank"
          rel="noopener noreferrer"
          className="w-24 transform rounded-lg bg-black px-6 py-2 text-center font-medium text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-gray-800 md:w-32 dark:bg-white dark:text-black dark:hover:bg-gray-200"
        >
          GitHub
        </a>
        {isAuthenticated && <UserMenu />}
      </div>
    </nav>
  );
};
