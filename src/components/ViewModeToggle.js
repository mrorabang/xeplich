import React from 'react';

const ViewModeToggle = ({ onClick }) => {
  return (
    <button
      type="button"
      className="btn btn-primary me-2"
      onClick={onClick}
    >
      Chuyển đổi dạng lịch
    </button>
  );
};

export default ViewModeToggle;
