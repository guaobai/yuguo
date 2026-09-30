package cn.iocoder.yudao.module.member.controller.app.auth.vo;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import org.hibernate.validator.constraints.Length;

import javax.validation.constraints.AssertTrue;
import javax.validation.constraints.NotEmpty;
import javax.validation.constraints.Pattern;
import java.util.Objects;

@Schema(description = "用户 APP - 用户名注册 Request VO")
@Data
public class AppAuthRegisterReqVO {

    @Schema(description = "用户名", requiredMode = Schema.RequiredMode.REQUIRED, example = "mall_user")
    @NotEmpty(message = "用户名不能为空")
    @Length(min = 4, max = 20, message = "用户名长度为 4-20 位")
    @Pattern(regexp = "^[A-Za-z0-9_]+$", message = "用户名只能包含字母、数字和下划线")
    private String username;

    @Schema(description = "密码", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotEmpty(message = "密码不能为空")
    @Length(min = 6, max = 20, message = "密码长度为 6-20 位")
    @Pattern(regexp = "^(?=.*[A-Za-z])(?=.*\\d)\\S+$", message = "密码必须包含字母和数字")
    private String password;

    @Schema(description = "确认密码", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotEmpty(message = "确认密码不能为空")
    private String confirmPassword;

    @Schema(description = "滑块验证码校验值", requiredMode = Schema.RequiredMode.REQUIRED)
    private String captchaVerification;

    @AssertTrue(message = "两次输入的密码不一致")
    public boolean isPasswordConfirmed() {
        return Objects.equals(password, confirmPassword);
    }

}
