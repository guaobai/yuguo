package cn.iocoder.yudao.module.member.controller.app.auth.vo;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import org.hibernate.validator.constraints.Length;

import javax.validation.constraints.NotEmpty;
import javax.validation.constraints.Pattern;

@Schema(description = "用户 APP - 用户名 + 密码登录 Request VO")
@Data
public class AppAuthUsernameLoginReqVO {

    @Schema(description = "用户名", requiredMode = Schema.RequiredMode.REQUIRED, example = "mall_user")
    @NotEmpty(message = "用户名不能为空")
    @Length(min = 4, max = 20, message = "用户名长度为 4-20 位")
    @Pattern(regexp = "^[A-Za-z0-9_]+$", message = "用户名只能包含字母、数字和下划线")
    private String username;

    @Schema(description = "密码", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotEmpty(message = "密码不能为空")
    @Length(min = 6, max = 20, message = "密码长度为 6-20 位")
    private String password;

    @Schema(description = "滑块验证码校验值", requiredMode = Schema.RequiredMode.REQUIRED)
    private String captchaVerification;

}
