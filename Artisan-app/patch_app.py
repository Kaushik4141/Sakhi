import sys

def patch_app_js():
    with open("App.js", "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Imports
    import_target = "import AsyncStorage from '@react-native-async-storage/async-storage';"
    import_replacement = import_target + "\nimport * as ImagePicker from 'expo-image-picker';\nimport { Image, ActivityIndicator } from 'react-native';"
    content = content.replace(import_target, import_replacement)

    # 2. HTTP_URL
    url_target = "const WS_URL = `ws://${WS_HOST}:8787/ws`;"
    url_replacement = url_target + "\nconst HTTP_URL = `http://${WS_HOST}:8787/upload-product`;"
    content = content.replace(url_target, url_replacement)

    # 3. App State
    state_target = "const [currentLanguage, setCurrentLanguage] = useState('en');"
    state_replacement = state_target + "\n  const [artisanId, setArtisanId] = useState(null);\n  const [isGeneratingPoster, setIsGeneratingPoster] = useState(false);\n  const [posterUrl, setPosterUrl] = useState(null);"
    content = content.replace(state_target, state_replacement)

    # 4. artisan_created WS Handler
    artisan_created_target = """        if (response.type === 'artisan_created' && response.artisanId) {
          console.log('[ONBOARDING] Artisan profile created! ID:', response.artisanId, 'Shop:', response.shopSlug);
          try {
            await AsyncStorage.setItem('artisan_id', response.artisanId);"""
            
    artisan_created_replacement = """        if (response.type === 'artisan_created' && response.artisanId) {
          console.log('[ONBOARDING] Artisan profile created! ID:', response.artisanId, 'Shop:', response.shopSlug);
          try {
            await AsyncStorage.setItem('artisan_id', response.artisanId);
            setArtisanId(response.artisanId);"""
    content = content.replace(artisan_created_target, artisan_created_replacement)

    # 5. useEffect
    use_effect_target = """        const savedLang = await AsyncStorage.getItem('user_language');
        if (savedLang) {
          setCurrentLanguage(savedLang);
        }
      } catch (e) {"""
    
    use_effect_replacement = """        const savedLang = await AsyncStorage.getItem('user_language');
        if (savedLang) {
          setCurrentLanguage(savedLang);
        }
        const savedArtisan = await AsyncStorage.getItem('artisan_id');
        if (savedArtisan) {
          setArtisanId(savedArtisan);
        }
      } catch (e) {"""
    content = content.replace(use_effect_target, use_effect_replacement)

    # 6. handleTakePhoto
    handle_photo_target = "  if (!hasSelectedLanguage) {"
    
    handle_photo_replacement = """  const handleTakePhoto = async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        alert("Camera permission is required to list products!");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        base64: true,
        quality: 0.6,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setIsGeneratingPoster(true);
        const imageBase64 = result.assets[0].base64;
        
        console.log('[HTTP] Uploading product photo...', HTTP_URL);
        const response = await fetch(HTTP_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            artisanId: artisanId || await AsyncStorage.getItem('artisan_id'),
            imageBase64: imageBase64
          })
        });
        
        const data = await response.json();
        if (data.success && data.posterUrl) {
          setPosterUrl(data.posterUrl);
        } else {
          alert('Failed to generate product listing: ' + (data.error || 'Unknown error'));
        }
      }
    } catch (e) {
      console.error(e);
      alert('An error occurred during photo upload.');
    } finally {
      setIsGeneratingPoster(false);
    }
  };

  const closePoster = () => {
    setPosterUrl(null);
  };

  if (!hasSelectedLanguage) {"""
    content = content.replace(handle_photo_target, handle_photo_replacement)

    # 7. Button
    button_target = """            </Pressable>

            <Text style={styles.footerHint}>"""
            
    button_replacement = """            </Pressable>

            {/* List Product Photo Button */}
            {artisanId && !isRecording && (
              <TouchableOpacity
                style={{
                  marginTop: 20,
                  backgroundColor: '#48cae4',
                  paddingHorizontal: 24,
                  paddingVertical: 12,
                  borderRadius: 24,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                }}
                onPress={handleTakePhoto}
              >
                <Text style={{ fontSize: 18 }}>📸</Text>
                <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 16 }}>List Product (Take Photo)</Text>
              </TouchableOpacity>
            )}

            <Text style={styles.footerHint}>"""
    content = content.replace(button_target, button_replacement)

    # 8. Overlay
    overlay_target = """      {/* ── Slide-in Profile Panel ── */}
      {isProfileOpen && (
        <ProfilePanel onClose={() => setIsProfileOpen(false)} t={t} currentLang={currentLanguage} setLang={setCurrentLanguage} />
      )}
    </SafeAreaView>"""
    
    overlay_replacement = """      {/* ── Slide-in Profile Panel ── */}
      {isProfileOpen && (
        <ProfilePanel onClose={() => setIsProfileOpen(false)} t={t} currentLang={currentLanguage} setLang={setCurrentLanguage} />
      )}

      {/* ── Full Screen Loading Overlay ── */}
      {isGeneratingPoster && (
        <View style={StyleSheet.absoluteFillObject}>
          <View style={styles.confirmOverlay}>
            <ActivityIndicator size="large" color="#48cae4" />
            <Text style={[styles.confirmText, { marginTop: 20 }]}>Generating Marketing Poster...</Text>
            <Text style={{ color: '#fff', opacity: 0.7, marginTop: 10 }}>Analyzing image and conversation</Text>
          </View>
        </View>
      )}

      {/* ── Full Screen Poster Display ── */}
      {posterUrl && (
        <View style={StyleSheet.absoluteFillObject}>
          <View style={styles.confirmOverlay}>
            <View style={{ width: '90%', height: '80%', backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden' }}>
              <Image source={{ uri: posterUrl }} style={{ width: '100%', height: '100%', resizeMode: 'contain' }} />
            </View>
            <TouchableOpacity 
              style={{ marginTop: 20, backgroundColor: '#48cae4', paddingHorizontal: 30, paddingVertical: 15, borderRadius: 25 }}
              onPress={closePoster}
            >
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 18 }}>Awesome!</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>"""
    content = content.replace(overlay_target, overlay_replacement)

    with open("App.js", "w", encoding="utf-8") as f:
        f.write(content)
        
    print("Patch applied.")

if __name__ == "__main__":
    patch_app_js()
