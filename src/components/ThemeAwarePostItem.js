import React from 'react';
import { useTheme } from '../context/ThemeContext';
import PostItem from './PostItem'; // New Gen Z UI
import PostItemOld from './PostItemold'; // Old bright UI

const ThemeAwarePostItem = ({ post, onOptionsPress }) => {
  const { isDarkMode } = useTheme();

  // Dark Mode ON = New Gen Z UI (PostItem.js)
  // Dark Mode OFF = Old bright UI (PostItemold.js)
  return isDarkMode ? 
    <PostItem post={post} onOptionsPress={onOptionsPress} /> : 
    <PostItemOld post={post} onOptionsPress={onOptionsPress} />;
};

export default ThemeAwarePostItem;
