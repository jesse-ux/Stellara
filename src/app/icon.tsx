import { ImageResponse } from "next/og";

export const size = {
  width: 512,
  height: 512,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          borderRadius: 128,
          background:
            "radial-gradient(circle at 50% 15%, rgba(216,179,106,0.18), transparent 38%), linear-gradient(180deg, #10131b 0%, #0a0d14 100%)",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 50% 118%, rgba(91,112,148,0.55) 0%, rgba(10,13,20,0) 45%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 72,
            left: 64,
            color: "#fbf7ea",
            fontSize: 320,
            fontStyle: "italic",
            fontFamily: "Georgia, Times New Roman, serif",
            lineHeight: 1,
          }}
        >
          S
        </div>
        <div
          style={{
            position: "absolute",
            top: 92,
            left: 128,
            width: 292,
            height: 150,
            borderTop: "12px solid rgba(208, 213, 224, 0.9)",
            borderRadius: "50%",
            transform: "rotate(-8deg)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 68,
            right: 72,
            width: 64,
            height: 64,
            background:
              "radial-gradient(circle, rgba(255,249,214,1) 0%, rgba(255,225,140,0.95) 45%, rgba(216,179,106,0.25) 72%, rgba(216,179,106,0) 100%)",
            transform: "rotate(45deg)",
            boxShadow: "0 0 28px rgba(255,214,108,0.65)",
          }}
        />
      </div>
    ),
    size
  );
}
