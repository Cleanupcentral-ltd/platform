import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Link } from "react-router";
import horizontalFullColour from "@/imports/IMG_1776556945431__2_.png";

type PageProps = { title: string; activePath: string };
const navigation = [
  ["Home", "/home"],
  ["About", "/about"],
  ["Cleaning Services", "/cleaning-services"],
  ["Property Support", "/property-support"],
  ["Contact", "/contact"],
] as const;

function Logo() {
  return <span className="block h-10 w-[145px] overflow-hidden sm:h-11 sm:w-[180px]"><img className="size-full scale-[1.65] object-contain" src={horizontalFullColour} alt="Clean Up Central"/></span>;
}
function QuoteButton({ full = false }: { full?: boolean }) {
  return <span className={`inline-flex min-h-12 items-center justify-center rounded-[4px] bg-[#B08A3C] px-5 text-[11px] font-bold uppercase tracking-[.08em] text-white shadow-[inset_0_-1px_0_rgba(18,18,18,.25)] transition duration-[var(--motion-standard)] ease-[var(--ease-out)] hover:bg-[#7A5A1E] ${full ? "w-full" : ""}`}>Get a Quote</span>;
}

export default function PlaceholderPage({ title, activePath }: PageProps) {
 const [drawer, setDrawer] = useState(false);
 return <main className="flex min-h-screen flex-col bg-[#FAF9F6] font-sans text-[#121212]">
  <header className="sticky top-0 z-30 border-b border-[#D8D5CF] bg-white/95 backdrop-blur"><div className="relative mx-auto flex h-[68px] max-w-[1440px] items-center justify-between px-5 sm:h-20 sm:px-10 lg:px-16"><Link to="/home" aria-label="Clean Up Central home"><Logo/></Link><nav className="absolute left-1/2 hidden h-full -translate-x-1/2 items-center gap-6 lg:flex">{navigation.map(([label,to]) => <Link key={label} to={to} className={`flex h-full items-center border-b-2 text-[10px] font-bold uppercase tracking-[.09em] transition duration-[var(--motion-standard)] ease-[var(--ease-out)] ${activePath === to ? "border-[#B08A3C] text-[#121212]" : "border-transparent text-[#66635E] hover:text-[#121212]"}`}>{label}</Link>)}</nav><Link className="hidden lg:block" to="/quote"><QuoteButton/></Link><button onClick={() => setDrawer(!drawer)} className="grid size-11 place-items-center border border-[#D8D5CF] lg:hidden" aria-label="Toggle navigation">{drawer ? <X size={20}/> : <Menu size={20}/>}</button></div>{drawer && <div className="border-t border-[#D8D5CF] bg-white px-5 pb-5 transition duration-[var(--motion-slow)] ease-[var(--ease-in-out)] lg:hidden">{navigation.map(([label,to]) => <Link onClick={() => setDrawer(false)} key={label} to={to} className={`block border-b border-[#D8D5CF] py-4 text-xs font-bold uppercase tracking-[.1em] ${activePath === to ? "text-[#B08A3C]" : ""}`}>{label}</Link>)}<Link onClick={() => setDrawer(false)} className="mt-4 block" to="/quote"><QuoteButton full/></Link></div>}</header>
  <section className="flex flex-1 items-center border-b border-[#D8D5CF]"><div className="mx-auto w-full max-w-[1440px] px-5 py-24 sm:px-10 sm:py-32 lg:px-16"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#66635E]">Clean Up Central</p><h1 className="mt-6 font-serif text-[54px] font-medium leading-[.96] tracking-[-.035em] sm:text-[64px]">{title}</h1><p className="mt-5 text-[16px] leading-7 text-[#66635E]">Page under construction.</p></div></section>
  <footer className="bg-white"><div className="mx-auto grid max-w-[1440px] gap-8 px-5 py-9 sm:px-10 md:grid-cols-[1.3fr_1fr_1fr] lg:px-16"><div><Logo/><p className="mt-5 max-w-xs text-xs leading-5 text-[#66635E]">Professional cleaning and considered property support across London.</p></div><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#66635E]">Explore</p><div className="mt-4 space-y-2 text-xs"><Link className="block hover:text-[#B08A3C]" to="/cleaning-services">Cleaning Services</Link><Link className="block hover:text-[#B08A3C]" to="/property-support">Property Support</Link><Link className="block hover:text-[#B08A3C]" to="/quote">Get a Quote</Link></div></div><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#66635E]">Contact</p><p className="mt-4 text-xs leading-6 text-[#66635E]">Phone: [Phone number]<br/>Email: [Email address]<br/>Serving the whole of London</p></div></div><div className="mx-auto max-w-[1440px] border-t border-[#D8D5CF] px-5 py-4 text-[10px] font-bold uppercase tracking-[.1em] text-[#66635E] sm:px-10 lg:px-16">© Clean Up Central · All rights reserved</div></footer>
 </main>;
}
