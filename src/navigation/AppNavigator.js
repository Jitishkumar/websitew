import React, { useEffect, useState } from 'react';
import { View, Platform, Text } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNotifications } from '../context/NotificationContext';
import { useMessages } from '../context/MessageContext';
import HomeScreen from '../screens/HomeScreen';
import LoginScreen from '../screens/LoginScreen';
import SignupScreen from '../screens/SignupScreen';
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
import DonateScreen from '../screens/DonateScreen';
import WealthiestDonorsScreen from '../screens/WealthiestDonorsScreen';
import VerifyAccountScreen from '../screens/VerifyAccountScreen';
import { supabase } from '../config/supabase';
import PhotoTextViewerScreen from '../screens/PhotoTextViewerScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const TabNavigator = () => {
  const insets = useSafeAreaInsets();
  const { unreadCount: notificationUnreadCount } = useNotifications();
  const { unreadCount: messageUnreadCount } = useMessages();
  
  return (
  <Tab.Navigator
    screenOptions={{
      headerShown: false,
      tabBarStyle: {
        backgroundColor: '#000033',
        borderTopWidth: 0,
        height: 60 + (insets.bottom > 0 ? insets.bottom : 10),
        paddingBottom: insets.bottom > 0 ? insets.bottom : 5,
        position: 'absolute',
        elevation: 0,
        borderTopLeftRadius: 15,
        borderTopRightRadius: 15,
      },
      tabBarActiveTintColor: '#3399ff',
      tabBarInactiveTintColor: '#666666',
      tabBarHideOnKeyboard: true,
      tabBarLabelStyle: {
        paddingBottom: Platform.OS === 'ios' ? 0 : 5,
      },
    }}
  >
    <Tab.Screen 
      name="Home" 
      component={HomeScreen}
      options={{
        tabBarIcon: ({ color }) => (
          <Ionicons name="home-outline" size={24} color={color} />
        ),
      }}
    />
    <Tab.Screen 
      name="Messages" 
      component={MessagesScreen}
      options={{
        tabBarIcon: ({ color }) => (
          <View>
            <Ionicons name="chatbubble-outline" size={24} color={color} />
            {messageUnreadCount > 0 && (
              <View style={{
                position: 'absolute',
                right: -6,
                top: -3,
                backgroundColor: '#0095f6',
                borderRadius: 10,
                width: messageUnreadCount > 99 ? 20 : messageUnreadCount > 9 ? 18 : 16,
                height: 16,
                justifyContent: 'center',
                alignItems: 'center',
              }}>
                <Text style={{
                  color: 'white',
                  fontSize: messageUnreadCount > 99 ? 8 : 10,
                  fontWeight: 'bold',
                }}>
                  {messageUnreadCount > 99 ? '99+' : messageUnreadCount}
                </Text>
              </View>
            )}
          </View>
        ),
      }}
    />
    <Tab.Screen 
      name="Notifications" 
      component={NotificationsScreen}
      options={{
        tabBarIcon: ({ color }) => (
          <View>
            <Ionicons name="notifications-outline" size={24} color={color} />
            {notificationUnreadCount > 0 && (
              <View style={{
                position: 'absolute',
                right: -6,
                top: -3,
                backgroundColor: '#ff00ff',
                borderRadius: 10,
                width: notificationUnreadCount > 99 ? 20 : notificationUnreadCount > 9 ? 18 : 16,
                height: 16,
                justifyContent: 'center',
                alignItems: 'center',
              }}>
                <Text style={{
                  color: 'white',
                  fontSize: notificationUnreadCount > 99 ? 8 : 10,
                  fontWeight: 'bold',
                }}>
                  {notificationUnreadCount > 99 ? '99+' : notificationUnreadCount}
                </Text>
              </View>
            )}
          </View>
        ),
      }}
    />
    <Tab.Screen 
      name="Profile" 
      component={ProfileScreen}
      options={{
        tabBarIcon: ({ color }) => (
          <Ionicons name="person-outline" size={24} color={color} />
        ),
      }}
    />
  </Tab.Navigator>
  );
};

export const AppNavigator = () => {
  const [initialRoute, setInitialRoute] = useState(null);
  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      setInitialRoute(data.session ? 'MainApp' : 'Login');
    };
    checkSession();
  }, []);
  if (!initialRoute) return null;
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={initialRoute}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
      <Stack.Screen name="PostViewer" component={PostViewerScreen} options={{ headerShown: false }} />
      <Stack.Screen name="MainApp" component={TabNavigator} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="Search" component={SearchScreen} />
      <Stack.Screen name="Confession" component={ConfessionScreen} />
      <Stack.Screen name="UserProfileScreen" component={UserProfileScreen} />
      <Stack.Screen name="PrivateProfileScreen" component={PrivateProfileScreen} />
      <Stack.Screen name="MessageScreen" component={MessageScreen} />
      <Stack.Screen name="Stories" component={StoriesScreen} options={{ headerShown: false }} />
      <Stack.Screen name="AddAccount" component={AddAccountScreen} options={{ headerShown: false }} />
      <Stack.Screen name="CreatePost" component={CreatePostScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Trending" component={TrendingScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Comment" component={CommentScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Posts" component={PostsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Shorts" component={ShortsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ShortsComment" component={ShortsCommentScreen} options={{ headerShown: false }} />
      <Stack.Screen name="PhotoTextViewer" component={PhotoTextViewerScreen} options={{ headerShown: false }} />
      <Stack.Screen name="HomePage" component={HomePage} />
      <Stack.Screen name="CallPage" component={CallPage} />
      <Stack.Screen name="Donate" component={DonateScreen} options={{ headerShown: false }} />
      <Stack.Screen name="WealthiestDonors" component={WealthiestDonorsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="VerifyAccount" component={VerifyAccountScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
};