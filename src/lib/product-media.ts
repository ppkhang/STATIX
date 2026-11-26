// shortcut: media is mapped by slug in code (Wire has none yet); move to the database with A11 content editing.
type Media = { photo: string; art: string; model: string; cameraDistance?: string };

export const productMedia: Record<string, Media | undefined> = {
  "static-one": { photo: "/assets/speaker.jpg", art: "/assets/speaker_art.webp", model: "/assets/statix_cube.glb?v=3" },
  signal: { photo: "/assets/amp.jpg", art: "/assets/amp_art.webp", model: "/assets/statix_amp.glb?v=1" },
  stand: { photo: "/assets/stand.jpg", art: "/assets/stand_art.webp", model: "/assets/statix_stand.glb?v=1", cameraDistance: "140%" },
};
