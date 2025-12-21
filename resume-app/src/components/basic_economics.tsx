interface BasicEconomicsProps {
  readonly imageUrl: string;
  readonly altText: string;
}

export default function BasicEconomics({ imageUrl, altText }: Readonly<BasicEconomicsProps>) {
  return (
    <img
      src={imageUrl}
      alt={altText}
      className="w-28 h-auto rounded-lg shadow-xl"
    />
  );
}