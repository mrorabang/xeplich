import React from 'react';

const ViewModeToggle = ({ onClick }) => {
  return (
    <button
      type="button"
      className="view-mode-toggle-btn"
      onClick={onClick}
    >
      Chuyển đổi dạng lịch
    </button>
  );
};

export default ViewModeToggle;
