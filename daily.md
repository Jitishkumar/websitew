Step-by-step guide: embed Daily Prebuilt
First, you'll need a Daily room URL. Once you have one ready, replace DAILY_ROOM_URL in the code snippet below with your own room URL (e.g. https://your-team.daily.co/hello).

HTML
Copy to clipboard
<html>
  <script crossorigin src="https://unpkg.com/@daily-co/daily-js"></script>
  <body>
    <script>
      call = window.Daily.createFrame();
      call.join({ url: 'DAILY_ROOM_URL' });
    </script>
  </body>
</html>

You can either paste that code into your own html file and then open it in your browser, or remix this Glitch project if you’d prefer to experiment in a playground.

Read more about different room settings in our guide to setting up calls.

Importing daily-js through NPM
As an alternative to the script import shown here, you can also import daily-js via our NPM package as follows:

npm install @daily-co/daily-js

// or with yarn
yarn add @daily-co/daily-js

You can pass configuration properties to DailyCall.createFrame() to customize how the embedded Daily Prebuilt looks. Here's an example that sets the Daily Prebuilt to fullscreen:

JavaScript
Copy to clipboard
call = window.Daily.createFrame({
  showLeaveButton: true,
  iframeStyle: {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
  },
});

You can also set custom avatar images that will be displayed for muted participant tiles and in the People tab. When a custom avatar image is set, it will displayed on the participant's tile and in the People tab:

JavaScript
Copy to clipboard
call = window.Daily.createFrame({
  userData: {
    avatar: 'https://example.com/avatar.jpg',
  },
});

Video call with one participant using custom avatar image

Read about all the DailyCall properties in our reference docs, including iframeStyle and userData.

Related guides
Custom color themes
Configure Daily Prebuilt UI
Suggested Daily Prebuilt posts
Extending Daily Prebuilt video calls with a custom button
26/10/2022 — 4 min read

Build background blur into Daily calls with our newest API
21/01/2022 — 4 min read

Build a video chat app with Vue and Daily Prebuilt
18/08/2021 — 12 min read

Recent Daily Prebuilt posts
Build a real-time AI video meeting assistant with Daily and OpenAI
28/11/2023 — 14 min read

Adding a GPT-powered assistant to Daily video calls
05/09/2023 — 5 min read

Add two lines of CSS to keep your Daily Prebuilt embed on the screen while scrolling
28/08/2023 — 13 min read



functionality of the app so you know how to navigate it.

The App component is the top-level parent component. It renders either the home screen or the in-call view.


Two possible app views: home screen and in-call views
Let’s quickly review how the home screen works.

When you first land on the home screen, there’s an empty room URL text input, a “Create demo room” button, and a disabled “Join call” button.

If you know which Daily room you want to join, you can enter the room URL in the text input and press “Join call”, which will be enabled once the input has a value.

If you do not have a room URL, we’ve set up an endpoint that will create a new room for you using Daily’s REST API. This endpoint is called when the “Create room” button is pressed, which calls the method createRoom, defined in App:

<Button
    type="secondary"
    onPress={createRoom}
    label={
       appState === AppState.Creating
          ? 'Creating room...'
          : 'Create demo room'
    }
/>
JavaScript
App.tsx
const createRoom = () => {
  setRoomCreateError(false);
  setAppState(AppState.Creating);
  api
    .createRoom()
    .then((room) => {
      setRoomUrlFieldValue(room.url);
      setAppState(AppState.Idle);
    })
    .catch(() => {
      setRoomCreateError(true);
      setRoomUrlFieldValue(undefined);
      setAppState(AppState.Idle);
    });
};
JavaScript
App.tsx
Here, we update our appState state value to be in a temporary “creating” state, call api.createRoom(), and, if it’s successful, set our roomUrlFieldValue value and appState. (Both appState and roomUrlFieldValue are component state values initialized in App.)

Note: Take a look at api.ts to see the api.createRoom() method.

Whether you use your own Daily room URL or one created in the app, when you press the “Join call” button, it will take the roomUrlFieldValue, set the roomUrl state value with it, and kick off creating the Daily call object.

Here we have the “Join call” button:

/**
  * “Join call” button will call startCall on press
  */
<StartButton
   onPress={startCall}
   disabled={startButtonDisabled}
   starting={appState === AppState.Joining}
/>
JavaScript
App.tsx
Next, we call startCall:

/**
  * Join the room provided by the user or the
  * temporary room created by createRoom
 */
 const startCall = () => {
   setRoomUrl(roomUrlFieldValue);
 };
JavaScript
App.tsx
And lastly, a useEffect hook is triggered by the roomURL value getting updated, which creates our Daily call object (the brain of this operation!)

/**
 * Create the callObject as soon as we have a roomUrl.
 * This will trigger the call starting.
 */
useEffect(() => {
  if (!roomUrl) {
    return;
  }
  const newCallObject = Daily.createCallObject();
  setCallObject(newCallObject);
}, [roomUrl]);
JavaScript
App.tsx
The following line is where the call object is actually created:
const newCallObject = Daily.createCallObject();

Then, by setting that value in our component’s state, the call object instance can be referred to later:

setCallObject(newCallObject);

After the call object has been created, we can then actually join our room (finally! Considering we pressed the “Join call” button 😉)

useEffect(() => {
  if (!callObject || !roomUrl) {
    return;
  }
  callObject.join({ url: roomUrl }).catch((_) => {
    // Doing nothing here since we handle fatal join errors in another way,
    // via our listener attached to the 'error' event
  });
  setAppState(AppState.Joining);
}, [callObject, roomUrl]);
JavaScript
App.tsx
Here, in another useEffect hook in App, when the callObject and roomUrl state values are truthy, which they now are, we can actually join our call by passing the roomUrl to our call object instance.

This step is also where our app view will change from the home screen to the in-call view. This happens because of this line in the effect above: setAppState(AppState.Joining);

const showCallPanel = [
  AppState.Joining,
  AppState.Joined,
  AppState.Error,
].includes(appState);
JavaScript
App.tsx
When showCallPanel — shown above — is truthy, our in-call view will render instead of the home screen:

<View style={styles.container}>
    {showCallPanel ? (
         <View style={[
             styles.callContainerBase,
             	orientation === Orientation.Landscape
             		? styles.callContainerLandscape
             		: null,
         ]}>
             <CallPanel roomUrl={roomUrl || ''} />
             <Tray
                onClickLeaveCall={leaveCall}
                disabled={!enableCallButtons}
             />
    	</View>
	) : (
	… //home screen
    )
...
JavaScript
App.tsx
We’ll leave it at that for the home screen and focus on the CallPanel component — our in-call view — for the rest of this tutorial. If you have any questions about this section, please reach out! We’re happy to help. 🙌

Displaying video tiles in your Daily React Native app
Let’s start by familiarizing ourselves with what our in-call app UI is supposed to look like:


In-call UI with two participants (or one developer talking to herself, depending how you count it)
We have the local participant’s camera feed at the top left corner, the room URL and a button to copy it to your clipboard in the middle of the screen, and our tray at the bottom. If anyone is screen sharing, they’ll also be included as a small thumbnail at the top.

Note: Screen sharing can’t be initiated in this app but call participants can join the room from any platform, including a web app using daily-js, where screen sharing is permitted.

The tray (i.e. the Tray component) has buttons to toggle the local participant’s audio, video, and to leave the call.

When more participants join, their videos are shown in the middle of the screen, replacing the room URL information.

Iterating over our participant list
Now that we know what we’re talking about, let’s jump right to where we’re actually creating our participant videos with react-native-daily-js.

In CallPanel.tsx, we render an array called largeTiles, which represents the remote participants.

<ScrollView
     alwaysBounceVertical={false}
     alwaysBounceHorizontal={false}
     horizontal={orientation === Orientation.Landscape}
 >
     <View
        style={[
            styles.largeTilesContainerInnerBase,
                orientation === Orientation.Portrait
                 ? styles.largeTilesContainerInnerPortrait
                 : styles.largeTilesContainerInnerLandscape,
         ]}
      >
         {largeTiles} // <- our remote participants
      </View>
 </ScrollView>
JavaScript
CallPanel.tsx
Note: We’ve put this in a ScrollView but you may prefer a FlatList component if you know you will be having larger calls. (A FlatList will only render the visible tiles, which should help with performance. It’s less of a concern in 1-on-1 video calls.)

Our largeTiles (remote participants) and thumbnailTiles (the local participant or screen sharer) are determined by the same memoized function. The tiles in largeTiles can be either full size or half size depending on the number of participants.


Tile sizes when there are less than three participants and when there are more than three
/**
 * Get lists of large tiles and thumbnail tiles to render.
 */
const [largeTiles, thumbnailTiles] = useMemo(() => {
  let larges: JSX.Element[] = [];
  let thumbnails: JSX.Element[] = [];
  Object.entries(callState.callItems).forEach(([id, callItem]) => {
    let tileType: TileType;
    if (isScreenShare(id)) {
      tileType = TileType.Full;
    } else if (isLocal(id) || containsScreenShare(callState.callItems)) {
      tileType = TileType.Thumbnail;
    } else if (participantCount(callState.callItems) <= 3) {
      tileType = TileType.Full;
    } else {
      tileType = TileType.Half;
    }
    const tile = (
      <Tile
        key={id}
        videoTrackState={callItem.videoTrackState}
        audioTrackState={callItem.audioTrackState}
        mirror={usingFrontCamera && isLocal(id)}
        type={tileType}
        disableAudioIndicators={isScreenShare(id)}
        onPress={
          isLocal(id)
            ? flipCamera
            : () => {
                sendHello(id);
              }
        }
      />
    );
    if (tileType === TileType.Thumbnail) {
      thumbnails.push(tile);
    } else {
      larges.push(tile);
    }
  });
  return [larges, thumbnails];
}, [callState.callItems, flipCamera, sendHello, usingFrontCamera]);
JavaScript
CallPanel.tsx
Let’s step through this function:

We declare two arrays that we’ll be updating in this function: larges and thumbnails
We get an array of our call participants (Object.entries(callState.callItems)) and do the following for each (or forEach, if you will):
_Note: The tileType can be TileType.Full, TileType.Half, or TileType.Thumbnail. The latter is the local participant, and the first two options are for remote participants (our largeTiles).
If the “participant” is actually a screen share, we make it a full size tile
If the participant is local or currently sharing their screen, we make them a thumbnail
If the call has 3 or less participants total, remote participants will have full size tiles; otherwise, they’ll have half size tiles.
We then render a Tile component for each participant and update our larges and thumbnails arrays
Okay, we’ve come pretty far but we still need to render our actual video and audio for the participants, so bear with us!

Rendering participant media
The most important part of the Tile component is the mediaComponent, a memoized instance of the DailyMediaView component imported from react-native-daily-js:

import { DailyMediaView } from '@daily-co/react-native-daily-js';
...
const mediaComponent = useMemo(() => {
   return (
     <DailyMediaView
       videoTrack={videoTrack}
       audioTrack={audioTrack}
       mirror={props.mirror}
       // Assumption: thumbnails should appear layered on top of other tiles
       zOrder={props.type === TileType.Thumbnail ? 1 : 0}
       style={styles.media}
       objectFit="cover"
     />
   );
 }, [videoTrack, audioTrack, props.mirror, props.type]);
JavaScript
Tile.tsx
The videoTrack and audioTrack are props passed to Tile from CallPanel but are actually set in callState.ts:

function getCallItems(participants: { [id: string]: DailyParticipant }) {
 let callItems = { ...initialCallState.callItems }; // Ensure we *always* have a local participant
 for (const [id, participant] of Object.entries(participants)) {
   callItems[id] = {
     videoTrackState: participant.tracks.video,
     audioTrackState: participant.tracks.audio,
   };
   if (shouldIncludeScreenCallItem(participant)) {
     callItems[id + '-screen'] = {
       videoTrackState: participant.tracks.screenVideo,
       audioTrackState: participant.tracks.screenAudio,
     };
   }
 }
 return callItems;
}
JavaScript
callState.ts
We’re jumping around here a bit but the important thing to understand is that our Daily callObject provides our participant information (see: callObject.participants()) and our participant information contains their media (video/audio) tracks. We can then pass those tracks to the DailyMediaView component to actually play those tracks in the app.

Jumping back to the Tile component, we get the videoTrack and audioTrack values from the videoTrackState and audioTrackState props.

const videoTrack = useMemo(() => {
  return props.videoTrackState && props.videoTrackState.state === 'playable'
    ? props.videoTrackState.track!
    : null;
}, [props.videoTrackState]);

const audioTrack = useMemo(() => {
  return props.audioTrackState && props.audioTrackState.state === 'playable'
    ? props.audioTrackState.track!
    : null;
}, [props.audioTrackState]);
JavaScript
Tile.tsx
This means we use the tracks from the individual participant information if they’re available, and otherwise set that corresponding props to null. Both are valid types for the DailyMediaView videoTrack and audioTrack props.

Tile also has an overlay with the audio and camera muted icons when they apply (i.e. when there’s no track to play), but we won’t review that code here. Again, let us know if you have any questions. 🙏


Tile icon overlay when audio and/or video tracks are muted
Controlling your local devices in-call
As a final note, let’s see how our Tray component interacts with the Daily call object. As a reminder, it’s rendered in App.tsx at the same time the CallPanel component is rendered.


The Tray component on an Android device
As mentioned, the tray lets up control our local camera and microphone, as well as leave the current call to return to the home screen.

To toggle our local camera, we can call setLocalAudio on the call object instance.

const toggleCamera = useCallback(() => {
  callObject?.setLocalVideo(isCameraMuted);
}, [callObject, isCameraMuted]);
JavaScript
Tray.tsx
Similarly, we can toggle our microphone on or off with setLocalAudio.

const toggleMic = useCallback(() => {
  callObject?.setLocalAudio(isMicMuted);
}, [callObject, isMicMuted]);
JavaScript
Tray.tsx
Lastly, pressing the “Leave” button will call the leaveCall function call, a prop passed from App.

/**
  * Leave the current call.
  * If we're in the error state (AppState.Error),
  * we've already "left", so just
  * clean up our state.
  */
 const leaveCall = useCallback(() => {
   if (!callObject) {
     return;
   }
   if (appState === AppState.Error) {
     callObject.destroy().then(() => {
       setRoomUrl(undefined);
       setRoomUrlFieldValue(undefined);
       setCallObject(null);
       setAppState(AppState.Idle);
     });
   } else {
     setAppState(AppState.Leaving);
     callObject.leave();
   }
 }, [callObject, appState]);
JavaScript
App.tsx
Here, we’re destroying our call object instance and resetting the state in App to get back to our initial values.

