import { createClient } from "@supabase/supabase-js";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ pawrentId: string }>;
}

async function getPetByPawrentId(pawrentId: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data } = await supabase
    .from("pets")
    .select("id, name, species, breed, photo_url, pawrent_id")
    .eq("pawrent_id", pawrentId)
    .maybeSingle();

  return data;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { pawrentId } = await params;
  const pet = await getPetByPawrentId(pawrentId);

  if (!pet) {
    return { title: "ไม่พบข้อมูล · Pawrent" };
  }

  return {
    title: `${pet.name} · Pawrent`,
    description: `${pet.name} — ${pet.breed ?? pet.species ?? "สัตว์เลี้ยง"} · สแกนโดย PAWRENTS`,
    openGraph: {
      title: `${pet.name} · Pawrent`,
      description: `${pet.breed ?? pet.species ?? "สัตว์เลี้ยง"} · สแกนโดย PAWRENTS`,
      images: pet.photo_url ? [{ url: pet.photo_url }] : [],
    },
  };
}

export default async function PawrentPublicPage({ params }: Props) {
  const { pawrentId } = await params;
  const pet = await getPetByPawrentId(pawrentId);

  if (!pet) notFound();

  const speciesEmoji = pet.species === "cat" ? "🐱" : "🐶";

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ backgroundColor: "#FAF7F2" }}
    >
      <div
        className="w-full max-w-sm flex flex-col items-center gap-6"
        style={{
          background: "#FFFFFF",
          borderRadius: "28px",
          border: "1px solid #E8E2D8",
          boxShadow: "0 12px 40px rgba(46,42,46,0.10)",
          padding: "36px 28px",
        }}
      >
        {/* Branding */}
        <div
          style={{
            fontSize: "11px",
            fontWeight: 700,
            color: "#B8730A",
            letterSpacing: "2px",
            textTransform: "uppercase",
          }}
        >
          สแกนโดย PAWRENTS
        </div>

        {/* Pet photo — circular */}
        <div
          style={{
            width: "140px",
            height: "140px",
            borderRadius: "50%",
            border: "4px solid #FF8263",
            overflow: "hidden",
            backgroundColor: "#EDEDE8",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {pet.photo_url ? (
            <Image
              src={pet.photo_url}
              alt={pet.name}
              width={140}
              height={140}
              className="w-full h-full object-cover"
            />
          ) : (
            <span style={{ fontSize: "64px" }} aria-hidden>
              {speciesEmoji}
            </span>
          )}
        </div>

        {/* Pet name */}
        <div className="text-center flex flex-col gap-1">
          <h1
            style={{
              fontSize: "28px",
              fontWeight: 800,
              color: "#2E2A2E",
              lineHeight: 1.2,
            }}
          >
            {pet.name}
          </h1>
          {pet.breed && (
            <p style={{ fontSize: "14px", color: "#6B6560", fontWeight: 600 }}>{pet.breed}</p>
          )}
          <p
            style={{
              fontSize: "11px",
              color: "#6B6560",
              fontFamily: "monospace",
              marginTop: "4px",
            }}
          >
            {pet.pawrent_id}
          </p>
        </div>

        {/* Divider */}
        <div style={{ width: "100%", height: "1px", backgroundColor: "#E8E2D8" }} />

        {/* Coming soon section */}
        <div
          className="w-full rounded-[16px] flex flex-col items-center gap-2 py-4 px-4"
          style={{ backgroundColor: "#FAF7F2", border: "1px dashed #E8E2D8" }}
        >
          <span style={{ fontSize: "24px" }} aria-hidden>
            🏥
          </span>
          <p
            style={{
              fontSize: "13px",
              fontWeight: 700,
              color: "#2E2A2E",
              textAlign: "center",
            }}
          >
            เร็วๆ นี้: เช็คอินที่คลินิก POPS
          </p>
          <p
            style={{
              fontSize: "11px",
              color: "#6B6560",
              textAlign: "center",
              lineHeight: 1.5,
            }}
          >
            บัตรนี้จะใช้เช็คอินที่คลินิก POPS ได้ทันที
          </p>
        </div>

        {/* Footer */}
        <div className="flex flex-col items-center gap-1" style={{ marginTop: "auto" }}>
          <p style={{ fontSize: "12px", fontWeight: 700, color: "#6B6560" }}>
            Pawrent · Part of POPS
          </p>
          <p style={{ fontSize: "10px", color: "#6B6560" }}>
            สร้างด้วย ❤️ เพื่อเจ้าของสัตว์เลี้ยงชาวไทย
          </p>
        </div>
      </div>
    </div>
  );
}
