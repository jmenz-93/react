const Avatar = () => {
  return (
    <div className="flex justify-center items-center">
      <img
        className="inline-block size-35 rounded-full shadow-2xl"
        src="/Image.JPG"
        alt="Avatar"
        width={180}
        height={120}
        style={{ objectFit: 'cover', objectPosition: 'center top' }}
      />
    </div>
  );
};

export default Avatar;
