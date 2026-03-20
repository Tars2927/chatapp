import { useRef } from "react";

export default function FileUpload({ disabled, isUploading, onSelect }) {
  const inputRef = useRef(null);

  function handleClick() {
    inputRef.current?.click();
  }

  function handleChange(event) {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) {
      return;
    }

    onSelect(selectedFile);
    event.target.value = "";
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        className="visually-hidden"
        onChange={handleChange}
        disabled={disabled || isUploading}
      />

      <button
        type="button"
        className="secondary-button upload-button"
        onClick={handleClick}
        disabled={disabled || isUploading}
      >
        {isUploading ? "Uploading..." : "Attach"}
      </button>
    </>
  );
}
