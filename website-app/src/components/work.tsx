interface WorkProps {
  imageUrl: string;
  linkUrl: string;
  altText: string;
  size?: string;
}

const WorkImage: React.FC<WorkProps> = ({ imageUrl, linkUrl, altText, size = 'w-20' }) => {
  const handleClick = () => {
    window.location.href = linkUrl;
  };

  return (
    <div >
      <button
        onClick={handleClick}
        className={`transition-transform hover:scale-110 ${size}`}
      >
      <img
        src={imageUrl}
        alt={altText}
        loading="lazy"
        style={{ cursor: 'pointer' }}
      />
    </button>
    </div>
  );
};

export default WorkImage;