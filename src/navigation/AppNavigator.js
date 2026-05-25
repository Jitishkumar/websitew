import React, { useEffect, useState, useRef } from 'react';
import { View, Platform, Text, Animated, TouchableOpacity, Dimensions } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNotifications } from '../context/NotificationContext';
import { useMessages } from '../context/MessageContext';
import HomeScreen from '../screens/HomeScreen';
import LoginScreen from '../screens/LoginScreen';
import SignupScreen from '../screens/SignupScreen';
import OTPVerificationScreen from '../screens/OTPVerificationScreen';
import ProfileScreen from '../screens/ProfileScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import MessagesScreen from '../screens/MessagesScreen';
import MessageScreen from '../screens/MessageScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import SearchScreen from '../screens/SearchScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import PrivateProfileScreen from '../screens/PrivateProfileScreen';
import StoriesScreen from '../screens/StoriesScreen';
import AddAccountScreen from '../screens/AddAccountScreen';
import ConfessionScreen from '../screens/ConfessionScreen';
import CreatePostScreen from '../screens/CreatePostScreen';
import TrendingScreen from '../screens/TrendingScreen';
import CommentScreen from '../screens/CommentScreen';
import PostViewerScreen from '../screens/PostViewerScreen';
import SettingsScreen from '../screens/SettingsScreen';
import PostsScreen from '../screens/PostsScreen';
import ShortsScreen from '../screens/ShortsScreen';
import ShortsCommentScreen from '../screens/ShortsCommentScreen';
import HomePage from '../screens/HomePage';
import CallPage from '../screens/CallPage';
import MatchConfirmScreen from '../screens/MatchConfirmScreen';
import DonateScreen from '../screens/DonateScreen';
import WealthiestDonorsScreen from '../screens/WealthiestDonorsScreen';
import VerifyAccountScreen from '../screens/VerifyAccountScreen';
import { supabase } from '../lib/supabase';
import PhotoTextViewerScreen from '../screens/PhotoTextViewerScreen';
import MessageSettingsScreen from '../screens/MessageSettingsScreen';
import BlockedUsersScreen from '../screens/BlockedUsersScreen';
import ChangePasswordScreen from '../screens/ChangePassword';
import ConfessionCommentScreen from '../screens/ConfessionCommentScreen';
import ConfessionButtonScreen from '../screens/ConfessionButton';
import ConfessionPersonScreen from '../screens/ConfessionPersonScreen';
import ConfessionPersonCommentScreen from '../screens/ConfessionPersonCommentScreen';
import ReelsScreen from '../screens/ReelsScreen';
import ShareUserSelectionScreen from '../screens/ShareUserSelectionScreen';
import StoryCreationScreen from '../screens/StoryCreationScreen';
import CreateGroupScreen from '../screens/CreateGroupScreen';
import GroupChatScreen from '../screens/GroupChatScreen';
import GroupInfoScreen from '../screens/GroupInfoScreen';
import NearbyPeopleScreen from '../screens/NearbyPeople';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Optimized Tab Bar Component
const OptimizedTabBar = ({ state, descriptors, navigation }) => {
  const insets = useSafeAreaInsets();
  const { unreadCount: messageUnreadCount, fetchUnreadCount } = useMessages();
  
  // Hide tab bar on ReelsScreen
  const currentRoute = state.routes[state.index];
  if (currentRoute.name === 'Reels') {
    return null;
  }
  
  // Fetch unread count when component mounts
  useEffect(() => {
    fetchUnreadCount();
  }, []);
  
  const getTabIcon = (routeName, focused, color) => {
    let iconName;
    switch (routeName) {
      case 'Home':
        iconName = focused ? 'home' : 'home-outline';
        break;
      case 'Reels':
        iconName = focused ? 'film' : 'film-outline';
        break;
      case 'Messages':
        iconName = focused ? 'chatbubble' : 'chatbubble-outline';
        break;
      case 'Confession':
        iconName = focused ? 'heart' : 'heart-outline';
        break;
      case 'Profile':
        iconName = focused ? 'person' : 'person-outline';
        break;
      default:
        iconName = 'home-outline';
    }
    return iconName;
  };
  
  return (
    <View style={{
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: 80 + (insets.bottom > 0 ? insets.bottom : 10),
      paddingBottom: insets.bottom > 0 ? insets.bottom : 10,
      backgroundColor: '#1a1a1a',
      borderTopWidth: 1,
      borderTopColor: 'rgba(255, 255, 255, 0.1)',
    }}>
      
      {/* Tab buttons container */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingTop: 15,
        paddingHorizontal: 20,
      }}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label = options.tabBarLabel !== undefined ? options.tabBarLabel : options.title !== undefined ? options.title : route.name;
          const isFocused = state.index === index;
          
          // Skip hidden tabs
          if (options.tabBarButton === null) return null;
          
          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };
          
          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              style={{
                flex: 1,
                alignItems: 'center',
                paddingVertical: 8,
                paddingHorizontal: 4,
              }}
            >
              <View style={{ alignItems: 'center' }}>
                {/* Icon container */}
                <View style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isFocused ? 'rgba(0, 122, 255, 0.15)' : 'transparent',
                  overflow: 'visible',
                }}>
                  
                  {/* Message badge for Messages tab */}
                  {route.name === 'Messages' && messageUnreadCount > 0 && (
                    <View
                      style={{
                        position: 'absolute',
                        right: -8,
                        top: -8,
                        zIndex: 10,
                        backgroundColor: '#FF3B30',
                        borderRadius: 10,
                        minWidth: messageUnreadCount > 99 ? 22 : messageUnreadCount > 9 ? 20 : 18,
                        height: 18,
                        justifyContent: 'center',
                        alignItems: 'center',
                        paddingHorizontal: 4,
                        borderWidth: 2,
                        borderColor: '#1a1a1a',
                      }}
                    >
                      <Text style={{
                        color: 'white',
                        fontSize: messageUnreadCount > 99 ? 9 : 11,
                        fontWeight: 'bold',
                      }}>
                        {messageUnreadCount > 99 ? '99+' : messageUnreadCount}
                      </Text>
                    </View>
                  )}
                  
                  <Ionicons
                    name={getTabIcon(route.name, isFocused, isFocused ? '#007AFF' : '#666')}
                    size={24}
                    color={isFocused ? '#007AFF' : '#666'}
                  />
                </View>
                
                {/* Label */}
                <Text
                  style={{
                    color: isFocused ? '#007AFF' : '#888',
                    fontSize: 11,
                    fontWeight: isFocused ? '600' : 'normal',
                    marginTop: 4,
                  }}
                >
                  {label}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const TabNavigator = () => {
  const insets = useSafeAreaInsets();
  const { unreadCount: notificationUnreadCount } = useNotifications();
  const { unreadCount: messageUnreadCount } = useMessages();
  
  return (
  <Tab.Navigator
    tabBar={(props) => <OptimizedTabBar {...props} />}
    screenOptions={{
      headerShown: false,
      tabBarHideOnKeyboard: true,
    }}
  >
    <Tab.Screen 
      name="Home" 
      component={HomeScreen}
    />
    <Tab.Screen 
      name="Reels" 
      component={ReelsScreen}
    />
    <Tab.Screen 
      name="Messages" 
      component={MessagesScreen}
    />
    <Tab.Screen 
      name="Confession" 
      component={ConfessionButtonScreen}
    />
    <Tab.Screen 
      name="Profile" 
      component={ProfileScreen}
    />
  </Tab.Navigator>
  );
};

const AppNavigator = () => {
  const [initialRoute, setInitialRoute] = useState('Login'); // Default to Login
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    const checkSession = async () => {
      try {
        // Set a timeout for the session check
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Session check timeout')), 2000)
        );
        
        const { data } = await Promise.race([sessionPromise, timeoutPromise]);
        setInitialRoute(data.session ? 'MainApp' : 'Login');
      } catch (error) {
        console.log('Session check failed, defaulting to Login:', error.message);
        setInitialRoute('Login');
      } finally {
        setIsLoading(false);
      }
    };
    
    checkSession();
  }, []);

  // Don't render anything while loading
  if (isLoading) {
    return null;
  }
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={initialRoute}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
      <Stack.Screen name="OTPVerification" component={OTPVerificationScreen} />
      <Stack.Screen name="PostViewer" component={PostViewerScreen} options={{ headerShown: false }} />
      <Stack.Screen name="MainApp" component={TabNavigator} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="Search" component={SearchScreen} />
      <Stack.Screen name="ConfessionButton" component={ConfessionButtonScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Confession" component={ConfessionScreen} />
      <Stack.Screen name="ConfessionScreen" component={ConfessionScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ConfessionPersonScreen" component={ConfessionPersonScreen} options={{ headerShown: false }} />
      <Stack.Screen name="UserProfileScreen" component={UserProfileScreen} />
      <Stack.Screen name="PrivateProfileScreen" component={PrivateProfileScreen} />
      <Stack.Screen name="MessageScreen" component={MessageScreen} />
      <Stack.Screen name="Stories" component={StoriesScreen} options={{ headerShown: false }} />
      <Stack.Screen name="AddAccount" component={AddAccountScreen} options={{ headerShown: false }} />
      <Stack.Screen name="CreatePost" component={CreatePostScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Trending" component={TrendingScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Comment" component={CommentScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Posts" component={PostsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Shorts" component={ShortsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ShortsComment" component={ShortsCommentScreen} options={{ headerShown: false }} />
      <Stack.Screen name="PhotoTextViewer" component={PhotoTextViewerScreen} options={{ headerShown: false }} />
      <Stack.Screen name="HomePage" component={HomePage} />
      <Stack.Screen name="CallPage" component={CallPage} />
      <Stack.Screen name="MatchConfirm" component={MatchConfirmScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Donate" component={DonateScreen} options={{ headerShown: false }} />
      <Stack.Screen name="WealthiestDonors" component={WealthiestDonorsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="VerifyAccount" component={VerifyAccountScreen} options={{ headerShown: false }} />
      <Stack.Screen name="MessageSettings" component={MessageSettingsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="BlockedUsers" component={BlockedUsersScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ConfessionComment" component={ConfessionCommentScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ConfessionPerson" component={ConfessionPersonScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ConfessionPersonComment" component={ConfessionPersonCommentScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ShareUserSelection" component={ShareUserSelectionScreen} options={{ headerShown: false }} />
      <Stack.Screen name="StoryCreation" component={StoryCreationScreen} options={{ headerShown: false }} />
      <Stack.Screen name="CreateGroupScreen" component={CreateGroupScreen} options={{ headerShown: false }} />
      <Stack.Screen name="GroupChatScreen" component={GroupChatScreen} options={{ headerShown: false }} />
      <Stack.Screen name="GroupInfoScreen" component={GroupInfoScreen} options={{ headerShown: false }} />
      <Stack.Screen name="NearbyPeople" component={NearbyPeopleScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
};

export default AppNavigator;
