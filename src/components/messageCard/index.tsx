import React from 'react';
import styles from './style.module.css';
import { FaExclamationTriangle, FaCheckCircle, FaExclamationCircle } from 'react-icons/fa';
import { IoCloseSharp } from 'react-icons/io5';

interface MessageCardProps {
  message: string;
  type: 'success' | 'error' | 'warning';
  onClose: () => void;
  duration?: number; 
}

const MessageCard: React.FC<MessageCardProps> = ({ message, type, onClose, duration = 5000 }) => {

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <FaCheckCircle size={20} />;
      case 'error':
        return <FaExclamationTriangle size={20} />;
      case 'warning':
        return <FaExclamationCircle size={20} />;
      default:
        return null;
    }
  };

  const getContainerClass = () => {
    switch (type) {
      case 'success':
        return styles.successContainer;
      case 'error':
        return styles.errorContainer;
      case 'warning':
        return styles.warningContainer;
      default:
        return '';
    }
  };

  return (
    <div className={`${styles.messageContainer} ${getContainerClass()}`}>
      <div className={styles.contentWrapper}>
        <div className={styles.iconAndText}>
          <div className={styles.iconWrapper}>
            {getIcon()}
          </div>
          <p className={styles.messageText}>{message}</p>
        </div>
        <button onClick={onClose} className={styles.closeButton}>
          <IoCloseSharp size={20} />
        </button>
      </div>
      <div className={styles.progressBarContainer}>
        <div 
          className={styles.progressBar} 
          style={{ animationDuration: `${duration}ms` }} 
        />
      </div>
    </div>
  );
};

export default MessageCard;