import logoMark from '../assets/logo-mark.png'
import leafMark from '../assets/leaf-mark.png'
import heartStation from '../assets/heart-station.png'
import tongueUpload from '../assets/tongue-upload.png'

export function QingKangLogoMark() {
  return <img className="home-logo-svg" src={logoMark} alt="青康小站标志" />
}

export function HomeLeafMark() {
  return <img className="home-leaf-svg" src={leafMark} alt="" aria-hidden="true" />
}

export function HeartStationIllustration() {
  return (
    <img
      className="home-hero-illustration home-heart-station-img"
      src={heartStation}
      alt=""
      aria-hidden="true"
    />
  )
}

export function TongueUploadIllustration() {
  return (
    <img
      className="home-hero-illustration home-tongue-upload-img"
      src={tongueUpload}
      alt=""
      aria-hidden="true"
    />
  )
}
