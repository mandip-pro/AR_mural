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
      video: "/video/hls-output/index.m3u8",
      model: "",
      thumbnail:
        "https://res.cloudinary.com/mandip/image/upload/v1785823655/Rajdevi_Muncipality_Left_5_x_10_ft_gmglwm.png",
    },
    {
      targetIndex: 1,
      video: "/video/hls-output/index.m3u8",
      model: "",
      thumbnail:
        "https://res.cloudinary.com/mandip/image/upload/v1792040360/Image_yq8gun.jpg",
    },
    {
      targetIndex: 2,
      video: "/video/hls-output/index.m3u8",
      model: "",
      thumbnail:
        "https://res.cloudinary.com/mandip/image/upload/v1792040520/Rajdevi_Muncipality_Right_5_x_6_ft_gqfj4t.png",
    },
  ],
};

export default muralData;
