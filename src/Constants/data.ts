export interface TargetData {
  targetIndex: number;
  video: string;
  model: string;
  thumbnail: string;
}

export interface MuralData {
  mindFile: string;
  targets: TargetData[];
}

const muralData: MuralData = {
  mindFile: "/targets1.mind",
  targets: [
    {
      targetIndex: 0,
      video:
        "https://res.cloudinary.com/mandip/video/upload/v1785823218/flood_r3qhwi.mp4",
      model: "/goal.glb",
      thumbnail:
        "https://res.cloudinary.com/mandip/image/upload/v1785823153/flood_y7db6c.png",
    },
    {
      targetIndex: 1,
      video: "/video/hls-output/index.m3u8",
      model: "",
      thumbnail:
        "https://res.cloudinary.com/mandip/image/upload/v1785823655/Rajdevi_Muncipality_Left_5_x_10_ft_gmglwm.png",
    },
  ],
};

export default muralData;
