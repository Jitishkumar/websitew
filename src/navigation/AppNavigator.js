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
import DonateScreen from '../screens/DonateScreen';
import WealthiestDonorsScreen from '../screens/WealthiestDonorsScreen';
import VerifyAccountScreen from '../screens/VerifyAccountScreen';
import { supabase } from '../lib/supabase';
import PhotoTextViewerScreen from '../screens/PhotoTextViewerScreen';
import MessageSettingsScreen from '../screens/MessageSettingsScreen';
import BlockedUsersScreen from '../screens/BlockedUsersScreen';
import ConfessionCommentScreen from '../screens/ConfessionCommentScreen';
import ConfessionButtonScreen from '../screens/ConfessionButton'; // Import the new screen
import ConfessionPersonScreen from '../screens/ConfessionPersonScreen'; // Import the new Person Confession screen
import ConfessionPersonCommentScreen from '../screens/ConfessionPersonCommentScreen'; // Import the new Person Confession Comment screen
import ReelsScreen from '../screens/ReelsScreen'; // Import the new Reels screen
import ShareUserSelectionScreen from '../screens/ShareUserSelectionScreen';
import CreateGroupScreen from '../screens/CreateGroupScreen';
import GroupChatScreen from '../screens/GroupChatScreen';
import GroupInfoScreen from '../screens/GroupInfoScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Custom Premium Tab Bar Component
const PremiumTabBar = ({ state, descriptors, navigation }) => {
  const insets = useSafeAreaInsets();
  const { unreadCount: messageUnreadCount, fetchUnreadCount } = useMessages();
  
  // Fetch unread count when component mounts
  useEffect(() => {
    fetchUnreadCount();
  }, []);
  
  // Animation refs for ultra-premium effects
  const glowAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    // Start continuous animations
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
    
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
    
    Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 3000,
        useNativeDriver: true,
      })
    ).start();
    
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -3,
          duration: 2500,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 3,
          duration: 2500,
          useNativeDriver: true,
        }),
      ])
    ).start();
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
    }}>
      {/* Background with multiple gradient layers */}
      <LinearGradient
        colors={['rgba(5, 5, 32, 0.98)', 'rgba(15, 15, 45, 0.95)', 'rgba(25, 25, 60, 0.92)']}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          borderTopLeftRadius: 25,
          borderTopRightRadius: 25,
        }}
      />
      
      {/* Animated shimmer overlay */}
      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          borderTopLeftRadius: 25,
          borderTopRightRadius: 25,
          opacity: shimmerAnim.interpolate({
            inputRange: [0, 0.5, 1],
            outputRange: [0, 0.3, 0]
          }),
          transform: [{
            translateX: shimmerAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [-Dimensions.get('window').width, Dimensions.get('window').width]
            })
          }]
        }}
      >
        <LinearGradient
          colors={['transparent', 'rgba(255, 0, 255, 0.4)', 'rgba(0, 255, 255, 0.4)', 'transparent']}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 0}}
          style={{
            flex: 1,
            width: 200,
            transform: [{ skewX: '-20deg' }]
          }}
        />
      </Animated.View>
      
      {/* Glow effect border */}
      <Animated.View
        style={{
          position: 'absolute',
          top: -2,
          left: -2,
          right: -2,
          height: 4,
          borderTopLeftRadius: 27,
          borderTopRightRadius: 27,
          opacity: glowAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0.3, 1]
          }),
        }}
      >
        <LinearGradient
          colors={['#ff00ff', '#ff6b9d', '#00ffff', '#ff00ff']}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 0}}
          style={{
            flex: 1,
            borderTopLeftRadius: 27,
            borderTopRightRadius: 27,
          }}
        />
      </Animated.View>
      
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
                paddingHorizontal: 4, // Add horizontal padding to prevent clipping
              }}
            >
              <Animated.View
                style={{
                  alignItems: 'center',
                  transform: [
                    { scale: isFocused ? pulseAnim : 1 },
                    { translateY: isFocused ? floatAnim : 0 }
                  ],
                }}
              >
                {/* Icon glow background */}
                {isFocused && (
                  <Animated.View
                    style={{
                      position: 'absolute',
                      width: 50,
                      height: 50,
                      borderRadius: 25,
                      opacity: glowAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.3, 0.8]
                      }),
                      transform: [{
                        scale: glowAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 1.2]
                        })
                      }]
                    }}
                  >
                    <LinearGradient
                      colors={['rgba(255, 0, 255, 0.4)', 'rgba(255, 107, 157, 0.3)', 'rgba(0, 255, 255, 0.2)']}
                      style={{
                        flex: 1,
                        borderRadius: 25,
                      }}
                    />
                  </Animated.View>
                )}
                
                {/* Icon container with gradient background */}
                <View style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'visible', // Allow badge to show outside container
                }}>
                  {isFocused && (
                    <LinearGradient
                      colors={['rgba(255, 0, 255, 0.2)', 'rgba(0, 255, 255, 0.1)']}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        borderRadius: 20,
                      }}
                    />
                  )}
                  
                  {/* Message badge for Messages tab */}
                  {route.name === 'Messages' && messageUnreadCount > 0 && (
                    <Animated.View
                      style={{
                        position: 'absolute',
                        right: -8,
                        top: -8,
                        zIndex: 10,
                        transform: [{ scale: pulseAnim }]
                      }}
                    >
                      {/* Glow effect for badge */}
                      <Animated.View
                        style={{
                          position: 'absolute',
                          top: -2,
                          left: -2,
                          right: -2,
                          bottom: -2,
                          borderRadius: 12,
                          opacity: glowAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.5, 1]
                          }),
                        }}
                      >
                        <LinearGradient
                          colors={['rgba(255, 0, 255, 0.8)', 'rgba(255, 107, 157, 0.6)']}
                          style={{
                            flex: 1,
                            borderRadius: 12,
                          }}
                        />
                      </Animated.View>
                      
                      <LinearGradient
                        colors={['#ff00ff', '#ff6b9d']}
                        style={{
                          borderRadius: 10,
                          minWidth: messageUnreadCount > 99 ? 22 : messageUnreadCount > 9 ? 20 : 18,
                          height: 18,
                          justifyContent: 'center',
                          alignItems: 'center',
                          paddingHorizontal: 4,
                          borderWidth: 2,
                          borderColor: '#fff',
                        }}
                      >
                        <Text style={{
                          color: 'white',
                          fontSize: messageUnreadCount > 99 ? 9 : 11,
                          fontWeight: 'bold',
                          textShadowColor: 'rgba(0, 0, 0, 0.5)',
                          textShadowOffset: { width: 0, height: 1 },
                          textShadowRadius: 2,
                        }}>
                          {messageUnreadCount > 99 ? '99+' : messageUnreadCount}
                        </Text>
                      </LinearGradient>
                    </Animated.View>
                  )}
                  
                  <Ionicons
                    name={getTabIcon(route.name, isFocused, isFocused ? '#ff00ff' : '#666')}
                    size={24}
                    color={isFocused ? '#ff00ff' : '#666'}
                  />
                </View>
                
                {/* Label with glow effect */}
                <Animated.Text
                  style={{
                    color: isFocused ? '#ff00ff' : '#888',
                    fontSize: 11,
                    fontWeight: isFocused ? 'bold' : 'normal',
                    marginTop: 4,
                    textShadowColor: isFocused ? 'rgba(255, 0, 255, 0.5)' : 'transparent',
                    textShadowOffset: { width: 0, height: 0 },
                    textShadowRadius: isFocused ? 8 : 0,
                    opacity: isFocused ? glowAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.8, 1]
                    }) : 0.7,
                  }}
                >
                  {label}
                </Animated.Text>
              </Animated.View>
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
    tabBar={(props) => <PremiumTabBar {...props} />}
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
      <Stack.Screen name="Donate" component={DonateScreen} options={{ headerShown: false }} />
      <Stack.Screen name="WealthiestDonors" component={WealthiestDonorsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="VerifyAccount" component={VerifyAccountScreen} options={{ headerShown: false }} />
      <Stack.Screen name="MessageSettings" component={MessageSettingsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="BlockedUsers" component={BlockedUsersScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ConfessionComment" component={ConfessionCommentScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ConfessionPerson" component={ConfessionPersonScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ConfessionPersonComment" component={ConfessionPersonCommentScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ShareUserSelection" component={ShareUserSelectionScreen} options={{ headerShown: false }} />
      <Stack.Screen name="CreateGroupScreen" component={CreateGroupScreen} options={{ headerShown: false }} />
      <Stack.Screen name="GroupChatScreen" component={GroupChatScreen} options={{ headerShown: false }} />
      <Stack.Screen name="GroupInfoScreen" component={GroupInfoScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
};

export default AppNavigator;