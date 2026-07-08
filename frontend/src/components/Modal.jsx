import React, { useState } from 'react';

const Modal = ({ isOpen, type, title, desc, onClose, onSubmit, inputValue, setInputValue }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        {type === 'error' && <div className="modal-icon" style={{color: '#ff6b6b'}}>⚠️</div>}
        {type === 'success' && <div className="modal-icon" style={{color: '#69f070'}}>✅</div>}
        {type === 'prompt' && <div className="modal-icon" style={{color: 'var(--gd)'}}>🔍</div>}
        
        <h3 className="modal-title">{title}</h3>
        {desc && <p className="modal-desc">{desc}</p>}
        
        {type === 'prompt' && (
          <input 
            type="text" 
            className="modal-input" 
            value={inputValue} 
            onChange={(e) => setInputValue(e.target.value)} 
            placeholder="e.g. LM79C3"
            autoFocus
          />
        )}
        
        <div className="modal-actions">
          {(type === 'prompt' || type === 'confirm') && (
            <button className="modal-btn secondary" onClick={onClose}>Cancel</button>
          )}
          <button 
            className="modal-btn primary" 
            onClick={onSubmit || onClose}
          >
            {type === 'prompt' ? 'Join' : 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Modal;
