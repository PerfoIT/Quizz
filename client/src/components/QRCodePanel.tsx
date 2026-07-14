import { QRCodeSVG } from "qrcode.react";

type Props = {
  url: string;
  code: string;
};

export function QRCodePanel({ url, code }: Props) {
  return (
    <div className="mx-auto flex w-fit flex-col items-center rounded-lg border border-white/10 bg-white p-4 text-slate-950 shadow-glow">
      <QRCodeSVG value={url} size={180} />
      <div className="mt-3 text-center">
        <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Code session</div>
        <div className="font-mono text-3xl font-black tracking-[0.28em]">{code}</div>
      </div>
    </div>
  );
}
